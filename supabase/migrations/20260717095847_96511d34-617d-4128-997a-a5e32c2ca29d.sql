
-- 1. Add auction_log_id link on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS auction_log_id UUID REFERENCES public.auction_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_auction_log_id_idx ON public.orders(auction_log_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_auction_log_id_unique ON public.orders(auction_log_id) WHERE auction_log_id IS NOT NULL;

-- 2. Rewrite finalize_active_auction to also create a winner order
CREATE OR REPLACE FUNCTION public.finalize_active_auction()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_value JSONB; v_session UUID; v_top RECORD;
  v_participants INTEGER; v_total_bids INTEGER; v_bid_history JSONB;
  v_started TIMESTAMPTZ; v_log_id UUID; v_closer_name TEXT;
  v_winner_email TEXT; v_amount_cents INTEGER; v_image TEXT; v_prod_name TEXT; v_series TEXT;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT value INTO v_value FROM public.site_settings WHERE key='active_auction' FOR UPDATE;
  IF v_value IS NULL THEN RETURN NULL; END IF;
  v_session := NULLIF(v_value->>'sessionId','')::uuid;
  v_started := NULLIF(v_value->>'startedAt','')::timestamptz;
  SELECT display_name, amount, user_id INTO v_top FROM public.auction_events
   WHERE session_id = v_session AND kind='bid' ORDER BY amount DESC, created_at DESC LIMIT 1;
  SELECT COUNT(*) INTO v_total_bids FROM public.auction_events WHERE session_id=v_session AND kind='bid';
  SELECT COUNT(DISTINCT user_id) INTO v_participants FROM public.auction_events WHERE session_id=v_session AND user_id IS NOT NULL;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('user',display_name,'amount',amount,'at',created_at) ORDER BY created_at), '[]'::jsonb)
    INTO v_bid_history FROM public.auction_events WHERE session_id=v_session AND kind='bid';
  SELECT COALESCE(p.display_name, split_part(u.email,'@',1)) INTO v_closer_name
    FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id WHERE u.id = auth.uid();

  v_prod_name := v_value->>'productName';
  v_series := v_value->>'series';
  v_image := (v_value->'images'->>0);

  INSERT INTO public.auction_logs (
    session_id, product_name, brand, series, scale, image_url,
    winner_user_id, winner_name, winning_bid, total_bids, participant_count,
    started_at, ended_at, duration_seconds, status, closed_by_user_id, closed_by_name, bid_history
  ) VALUES (
    v_session, v_prod_name, v_value->>'brand', v_series, v_value->>'scale', v_image,
    v_top.user_id, v_top.display_name, v_top.amount,
    COALESCE(v_total_bids,0), COALESCE(v_participants,0), v_started, now(),
    CASE WHEN v_started IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - v_started))::int END,
    'closed', auth.uid(), v_closer_name, v_bid_history
  ) RETURNING id INTO v_log_id;

  -- Auto-create winner order if there was a winner
  IF v_top.user_id IS NOT NULL AND v_top.amount IS NOT NULL THEN
    SELECT email INTO v_winner_email FROM auth.users WHERE id = v_top.user_id;
    v_amount_cents := (v_top.amount * 100)::int;

    INSERT INTO public.orders (
      user_id, status, payment_method, subtotal_cents, total_cents,
      shipping_address, contact_email, auction_log_id, notes
    ) VALUES (
      v_top.user_id, 'pending', 'online', v_amount_cents, v_amount_cents,
      '{}'::jsonb, COALESCE(v_winner_email, ''), v_log_id,
      'Auction win: ' || COALESCE(v_prod_name, 'Unknown')
    );

    -- Insert order item snapshot
    INSERT INTO public.order_items (
      order_id, product_name, product_series, product_image,
      quantity, unit_price_cents, line_total_cents
    )
    SELECT o.id, v_prod_name, v_series, v_image, 1, v_amount_cents, v_amount_cents
    FROM public.orders o WHERE o.auction_log_id = v_log_id;
  END IF;

  UPDATE public.site_settings
     SET value = jsonb_set(jsonb_set(value, '{status}', to_jsonb('closed'::text), true),
                           '{closedAt}', to_jsonb(to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true),
         updated_at = now()
   WHERE key='active_auction';
  RETURN v_log_id;
END; $function$;
