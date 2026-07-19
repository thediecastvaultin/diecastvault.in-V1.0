
-- Drafts table
CREATE TABLE public.auction_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  series TEXT NOT NULL DEFAULT '',
  scale TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  starting_bid INTEGER NOT NULL DEFAULT 0,
  min_increment INTEGER NOT NULL DEFAULT 10,
  rules TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auction_drafts TO authenticated;
GRANT ALL ON public.auction_drafts TO service_role;
ALTER TABLE public.auction_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff can manage auction drafts"
  ON public.auction_drafts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER auction_drafts_updated_at BEFORE UPDATE ON public.auction_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Logs table
CREATE TABLE public.auction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  product_name TEXT NOT NULL,
  brand TEXT,
  series TEXT,
  scale TEXT,
  image_url TEXT,
  winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_name TEXT,
  winning_bid INTEGER,
  total_bids INTEGER NOT NULL DEFAULT 0,
  participant_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'closed',
  closed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by_name TEXT,
  bid_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auction_logs TO authenticated;
GRANT ALL ON public.auction_logs TO service_role;
ALTER TABLE public.auction_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff can manage auction logs"
  ON public.auction_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Finalize
CREATE OR REPLACE FUNCTION public.finalize_active_auction()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_value JSONB;
  v_session UUID;
  v_top RECORD;
  v_participants INTEGER;
  v_total_bids INTEGER;
  v_bid_history JSONB;
  v_started TIMESTAMPTZ;
  v_log_id UUID;
  v_closer_name TEXT;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT value INTO v_value FROM public.site_settings WHERE key='active_auction' FOR UPDATE;
  IF v_value IS NULL THEN RETURN NULL; END IF;

  v_session := NULLIF(v_value->>'sessionId','')::uuid;
  v_started := NULLIF(v_value->>'startedAt','')::timestamptz;

  SELECT display_name, amount, user_id INTO v_top
    FROM public.auction_events
   WHERE session_id = v_session AND kind='bid'
   ORDER BY amount DESC, created_at DESC LIMIT 1;

  SELECT COUNT(*) INTO v_total_bids FROM public.auction_events
    WHERE session_id=v_session AND kind='bid';
  SELECT COUNT(DISTINCT user_id) INTO v_participants FROM public.auction_events
    WHERE session_id=v_session AND user_id IS NOT NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('user',display_name,'amount',amount,'at',created_at) ORDER BY created_at), '[]'::jsonb)
    INTO v_bid_history
    FROM public.auction_events WHERE session_id=v_session AND kind='bid';

  SELECT COALESCE(p.display_name, split_part(u.email,'@',1)) INTO v_closer_name
    FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
   WHERE u.id = auth.uid();

  INSERT INTO public.auction_logs (
    session_id, product_name, brand, series, scale, image_url,
    winner_user_id, winner_name, winning_bid, total_bids, participant_count,
    started_at, ended_at, duration_seconds, status,
    closed_by_user_id, closed_by_name, bid_history
  ) VALUES (
    v_session,
    v_value->>'productName',
    v_value->>'brand',
    v_value->>'series',
    v_value->>'scale',
    (v_value->'images'->>0),
    v_top.user_id,
    v_top.display_name,
    v_top.amount,
    COALESCE(v_total_bids,0),
    COALESCE(v_participants,0),
    v_started,
    now(),
    CASE WHEN v_started IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - v_started))::int END,
    'closed',
    auth.uid(),
    v_closer_name,
    v_bid_history
  ) RETURNING id INTO v_log_id;

  DELETE FROM public.auction_events WHERE session_id = v_session;
  DELETE FROM public.site_settings WHERE key='active_auction';

  RETURN v_log_id;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_active_auction() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_active_auction() TO authenticated;

-- Clear (no archive)
CREATE OR REPLACE FUNCTION public.clear_active_auction()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_session UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT NULLIF(value->>'sessionId','')::uuid INTO v_session
    FROM public.site_settings WHERE key='active_auction';
  IF v_session IS NOT NULL THEN
    DELETE FROM public.auction_events WHERE session_id = v_session;
  END IF;
  DELETE FROM public.site_settings WHERE key='active_auction';
END;
$$;
REVOKE ALL ON FUNCTION public.clear_active_auction() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_active_auction() TO authenticated;

-- Bid trigger: only reset timer while status='live'
CREATE OR REPLACE FUNCTION public.auction_bid_reset_timer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_exp TEXT; v_status TEXT;
BEGIN
  IF NEW.kind = 'bid' THEN
    SELECT value->>'status' INTO v_status FROM public.site_settings WHERE key='active_auction';
    IF v_status = 'live' THEN
      new_exp := to_char((now() + interval '15 seconds') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      UPDATE public.site_settings
         SET value = jsonb_set(COALESCE(value,'{}'::jsonb),'{expiresAt}', to_jsonb(new_exp), true),
             updated_at = now()
       WHERE key='active_auction';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
