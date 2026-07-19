
CREATE OR REPLACE FUNCTION public.auction_finalize_if_expired()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB;
  v_status TEXT;
  v_expires TIMESTAMPTZ;
  v_session UUID;
  v_top RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;

  SELECT value INTO v_value FROM public.site_settings WHERE key = 'active_auction' FOR UPDATE;
  IF v_value IS NULL THEN RETURN FALSE; END IF;

  v_status := v_value->>'status';
  v_expires := NULLIF(v_value->>'expiresAt','')::timestamptz;
  v_session := NULLIF(v_value->>'sessionId','')::uuid;

  IF v_status <> 'live' OR v_expires IS NULL OR v_expires > now() THEN
    RETURN FALSE;
  END IF;

  UPDATE public.site_settings
     SET value = jsonb_set(jsonb_set(value, '{status}', to_jsonb('closed'::text), true),
                           '{closedAt}', to_jsonb(to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true),
         updated_at = now()
   WHERE key = 'active_auction';

  IF v_session IS NOT NULL THEN
    SELECT display_name, amount INTO v_top
      FROM public.auction_events
     WHERE session_id = v_session AND kind = 'bid'
     ORDER BY amount DESC, created_at DESC LIMIT 1;

    INSERT INTO public.auction_events (session_id, user_id, display_name, color, kind, text, tone)
    VALUES (v_session, auth.uid(), 'System', 'bg-violet-500/80', 'system',
            CASE WHEN v_top.display_name IS NOT NULL
                 THEN 'Auction Closed. Winner: ' || v_top.display_name || ' at ₹' || v_top.amount::text
                 ELSE 'Auction Closed. No bids placed.' END,
            'success');
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_finalize_if_expired() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_finalize_if_expired() TO authenticated;
