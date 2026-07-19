
-- 1) Events table
CREATE TABLE public.auction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-blue-500/80',
  kind TEXT NOT NULL CHECK (kind IN ('bid','msg','system')),
  text TEXT,
  amount INTEGER,
  tone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auction_events_session_created_idx ON public.auction_events (session_id, created_at);

GRANT SELECT ON public.auction_events TO anon, authenticated;
GRANT INSERT ON public.auction_events TO authenticated;
GRANT ALL ON public.auction_events TO service_role;

ALTER TABLE public.auction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read auction events"
  ON public.auction_events FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users insert their own events"
  ON public.auction_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2) Trigger: reset auction expiresAt when a bid is placed
CREATE OR REPLACE FUNCTION public.auction_bid_reset_timer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_exp TEXT;
BEGIN
  IF NEW.kind = 'bid' THEN
    new_exp := to_char((now() + interval '15 seconds') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    UPDATE public.site_settings
       SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{expiresAt}', to_jsonb(new_exp), true),
           updated_at = now()
     WHERE key = 'active_auction';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auction_bid_reset_timer
AFTER INSERT ON public.auction_events
FOR EACH ROW EXECUTE FUNCTION public.auction_bid_reset_timer();

-- 3) Enable realtime
ALTER TABLE public.auction_events REPLICA IDENTITY FULL;
ALTER TABLE public.site_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
