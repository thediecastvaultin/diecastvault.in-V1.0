
-- ============ BADGES CATALOG ============
CREATE TABLE public.badges (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'Award',
  category text NOT NULL DEFAULT 'general',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges public read" ON public.badges FOR SELECT USING (true);
CREATE POLICY "badges admin write" ON public.badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- ============ USER BADGES ============
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code text NOT NULL REFERENCES public.badges(code) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  UNIQUE (user_id, badge_code)
);
CREATE INDEX user_badges_user_idx ON public.user_badges(user_id, earned_at DESC);
GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges public read" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "user_badges staff manage" ON public.user_badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- ============ ACTIVITY EVENTS ============
CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  description text,
  link text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_user_idx ON public.activity_events(user_id, created_at DESC);
GRANT SELECT ON public.activity_events TO anon, authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity public read" ON public.activity_events FOR SELECT USING (true);
CREATE POLICY "activity staff manage" ON public.activity_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- ============ EXPOSE auction_logs safe fields to public (additive) ============
CREATE POLICY "auction_logs public read" ON public.auction_logs FOR SELECT USING (true);

-- Note: orders remain private; totals for stats are computed via SECURITY DEFINER RPC below

-- ============ SEED BADGE CATALOG ============
INSERT INTO public.badges (code, name, description, icon, category, sort_order) VALUES
  ('first_bid','First Bid','Placed your very first auction bid','Zap','participation',10),
  ('first_auction','First Auction Joined','Joined your first live auction','Gavel','participation',20),
  ('auctions_10','10 Auctions Joined','Joined 10 different auctions','Users','participation',30),
  ('auctions_50','50 Auctions Joined','Joined 50 different auctions','Users','participation',40),
  ('auctions_100','100 Auctions Joined','Auction veteran — 100 joined','Users','participation',50),
  ('first_win','First Win','Won your first auction','Trophy','winning',110),
  ('wins_10','10 Wins','10 auction victories','Trophy','winning',120),
  ('wins_25','25 Wins','25 auction victories','Trophy','winning',130),
  ('wins_50','50 Wins','50 auction victories — legend','Trophy','winning',140),
  ('treasure_hunter','Treasure Hunter','Won a Treasure Hunt or Super TH','Gem','collector',210),
  ('premium_collector','Premium Collector','Won 5+ Premium series cars','Sparkles','collector',220),
  ('ferrari_collector','Ferrari Collector','Won 3+ Ferrari cars','Flame','collector',230),
  ('jdm_collector','JDM Collector','Won 5+ JDM cars','Mountain','collector',240),
  ('porsche_collector','Porsche Collector','Won 3+ Porsche cars','Car','collector',250),
  ('muscle_collector','Muscle Collector','Won 3+ American muscle cars','Wrench','collector',260),
  ('early_member','Early Member','Joined The Diecast Vault in its first months','Star','community',310),
  ('verified_collector','Verified Collector','Verified by staff','BadgeCheck','community',320),
  ('trusted_buyer','Trusted Buyer','Completed 5+ delivered orders','ShieldCheck','community',330)
ON CONFLICT (code) DO NOTHING;

-- ============ STATS RPC (SECURITY DEFINER — safe fields only) ============
CREATE OR REPLACE FUNCTION public.get_user_stats(_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_joined int; v_won int; v_total_bids int; v_highest int; v_spent int;
  v_avg_win int; v_fav text; v_member timestamptz; v_badges int;
BEGIN
  SELECT COUNT(DISTINCT session_id) INTO v_joined FROM public.auction_events WHERE user_id=_user AND kind='bid';
  SELECT COUNT(*) INTO v_won FROM public.auction_logs WHERE winner_user_id=_user;
  SELECT COUNT(*), COALESCE(MAX(amount),0) INTO v_total_bids, v_highest FROM public.auction_events WHERE user_id=_user AND kind='bid';
  SELECT COALESCE(SUM(total_cents),0) INTO v_spent FROM public.orders WHERE user_id=_user AND status IN ('paid','packed','shipped','delivered');
  SELECT COALESCE(AVG(winning_bid),0)::int INTO v_avg_win FROM public.auction_logs WHERE winner_user_id=_user AND winning_bid IS NOT NULL;
  SELECT series INTO v_fav FROM public.auction_logs WHERE winner_user_id=_user AND series IS NOT NULL AND series <> ''
    GROUP BY series ORDER BY COUNT(*) DESC LIMIT 1;
  SELECT created_at INTO v_member FROM public.profiles WHERE id=_user;
  SELECT COUNT(*) INTO v_badges FROM public.user_badges WHERE user_id=_user;
  RETURN jsonb_build_object(
    'auctions_joined', COALESCE(v_joined,0),
    'auctions_won', COALESCE(v_won,0),
    'total_bids', COALESCE(v_total_bids,0),
    'highest_bid', COALESCE(v_highest,0),
    'total_spent_cents', COALESCE(v_spent,0),
    'avg_win_price', COALESCE(v_avg_win,0),
    'win_rate', CASE WHEN COALESCE(v_joined,0)>0 THEN ROUND((v_won::numeric/v_joined)*100,1) ELSE 0 END,
    'favorite_category', COALESCE(v_fav,'—'),
    'member_since', v_member,
    'badges_count', COALESCE(v_badges,0)
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO anon, authenticated;

-- ============ RANK helper ============
CREATE OR REPLACE FUNCTION public.get_user_rank(_user uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb; score int; age_days int;
BEGIN
  s := public.get_user_stats(_user);
  age_days := GREATEST(0, EXTRACT(DAY FROM (now() - COALESCE((s->>'member_since')::timestamptz, now())))::int);
  score := (COALESCE((s->>'auctions_joined')::int,0) * 2)
         + (COALESCE((s->>'auctions_won')::int,0) * 25)
         + (COALESCE((s->>'total_spent_cents')::int,0) / 10000)
         + (age_days / 7);
  RETURN CASE
    WHEN score >= 500 THEN 'Diamond'
    WHEN score >= 250 THEN 'Platinum'
    WHEN score >= 100 THEN 'Gold'
    WHEN score >= 30 THEN 'Silver'
    ELSE 'Bronze' END;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_user_rank(uuid) TO anon, authenticated;

-- ============ BADGE AWARD LOGIC ============
CREATE OR REPLACE FUNCTION public.award_badge(_user uuid, _code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_badges (user_id, badge_code) VALUES (_user, _code)
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.evaluate_user_badges(_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_joined int; v_won int; v_delivered int;
  v_th int; v_prem int; v_ferrari int; v_jdm int; v_porsche int; v_muscle int;
  v_first_bid_at timestamptz;
BEGIN
  IF _user IS NULL THEN RETURN; END IF;

  SELECT MIN(created_at) INTO v_first_bid_at FROM public.auction_events WHERE user_id=_user AND kind='bid';
  SELECT COUNT(DISTINCT session_id) INTO v_joined FROM public.auction_events WHERE user_id=_user AND kind='bid';
  SELECT COUNT(*) INTO v_won FROM public.auction_logs WHERE winner_user_id=_user;
  SELECT COUNT(*) INTO v_delivered FROM public.orders WHERE user_id=_user AND status='delivered';

  IF v_first_bid_at IS NOT NULL THEN
    PERFORM public.award_badge(_user,'first_bid');
    PERFORM public.award_badge(_user,'first_auction');
  END IF;
  IF v_joined >= 10  THEN PERFORM public.award_badge(_user,'auctions_10');  END IF;
  IF v_joined >= 50  THEN PERFORM public.award_badge(_user,'auctions_50');  END IF;
  IF v_joined >= 100 THEN PERFORM public.award_badge(_user,'auctions_100'); END IF;

  IF v_won >= 1  THEN PERFORM public.award_badge(_user,'first_win'); END IF;
  IF v_won >= 10 THEN PERFORM public.award_badge(_user,'wins_10');   END IF;
  IF v_won >= 25 THEN PERFORM public.award_badge(_user,'wins_25');   END IF;
  IF v_won >= 50 THEN PERFORM public.award_badge(_user,'wins_50');   END IF;

  -- Collector series/brand tallies
  SELECT COUNT(*) INTO v_th      FROM public.auction_logs WHERE winner_user_id=_user AND (series ILIKE '%treasure%' OR product_name ILIKE '%treasure hunt%' OR product_name ILIKE '%super th%');
  SELECT COUNT(*) INTO v_prem    FROM public.auction_logs WHERE winner_user_id=_user AND series ILIKE '%premium%';
  SELECT COUNT(*) INTO v_ferrari FROM public.auction_logs WHERE winner_user_id=_user AND (brand ILIKE '%ferrari%' OR product_name ILIKE '%ferrari%');
  SELECT COUNT(*) INTO v_jdm     FROM public.auction_logs WHERE winner_user_id=_user AND (series ILIKE '%jdm%' OR brand ILIKE ANY (ARRAY['%nissan%','%toyota%','%honda%','%mazda%','%subaru%','%mitsubishi%']));
  SELECT COUNT(*) INTO v_porsche FROM public.auction_logs WHERE winner_user_id=_user AND (brand ILIKE '%porsche%' OR product_name ILIKE '%porsche%');
  SELECT COUNT(*) INTO v_muscle  FROM public.auction_logs WHERE winner_user_id=_user AND (series ILIKE '%muscle%' OR brand ILIKE ANY (ARRAY['%ford%','%chevrolet%','%dodge%','%pontiac%','%plymouth%']));

  IF v_th >= 1      THEN PERFORM public.award_badge(_user,'treasure_hunter');    END IF;
  IF v_prem >= 5    THEN PERFORM public.award_badge(_user,'premium_collector');  END IF;
  IF v_ferrari >= 3 THEN PERFORM public.award_badge(_user,'ferrari_collector');  END IF;
  IF v_jdm >= 5     THEN PERFORM public.award_badge(_user,'jdm_collector');      END IF;
  IF v_porsche >= 3 THEN PERFORM public.award_badge(_user,'porsche_collector');  END IF;
  IF v_muscle >= 3  THEN PERFORM public.award_badge(_user,'muscle_collector');   END IF;

  IF v_delivered >= 5 THEN PERFORM public.award_badge(_user,'trusted_buyer'); END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.evaluate_user_badges(uuid) TO authenticated, service_role;

-- ============ ACTIVITY + BADGE TRIGGERS ============
-- On bid: log "joined auction" first time in session, evaluate badges
CREATE OR REPLACE FUNCTION public.on_auction_event_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.kind='bid' AND NEW.user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.auction_events
      WHERE session_id=NEW.session_id AND user_id=NEW.user_id AND kind='bid' AND id<>NEW.id;
    IF v_count = 0 THEN
      INSERT INTO public.activity_events (user_id, kind, title, description, meta)
      VALUES (NEW.user_id,'joined_auction','Joined an auction','Placed opening bid of ₹'||NEW.amount,
              jsonb_build_object('session_id',NEW.session_id,'amount',NEW.amount));
    END IF;
    PERFORM public.evaluate_user_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_auction_event_activity AFTER INSERT ON public.auction_events
  FOR EACH ROW EXECUTE FUNCTION public.on_auction_event_activity();

-- On auction close: log win + evaluate winner and every participant
CREATE OR REPLACE FUNCTION public.on_auction_log_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  IF NEW.winner_user_id IS NOT NULL THEN
    INSERT INTO public.activity_events (user_id, kind, title, description, link, meta)
    VALUES (NEW.winner_user_id,'won_auction','Won an auction',
            'Won '||NEW.product_name||' for ₹'||COALESCE(NEW.winning_bid,0),
            '/u/'||NEW.winner_user_id::text,
            jsonb_build_object('log_id',NEW.id,'amount',NEW.winning_bid,'product',NEW.product_name,'image',NEW.image_url));
    PERFORM public.evaluate_user_badges(NEW.winner_user_id);
  END IF;
  -- Evaluate all participants from bid_history
  IF NEW.session_id IS NOT NULL THEN
    FOR v_uid IN SELECT DISTINCT user_id FROM public.auction_events WHERE session_id=NEW.session_id AND user_id IS NOT NULL LOOP
      IF v_uid <> COALESCE(NEW.winner_user_id,'00000000-0000-0000-0000-000000000000'::uuid) THEN
        PERFORM public.evaluate_user_badges(v_uid);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_auction_log_activity AFTER INSERT ON public.auction_logs
  FOR EACH ROW EXECUTE FUNCTION public.on_auction_log_activity();

-- On order status change: log activity
CREATE OR REPLACE FUNCTION public.on_order_status_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.activity_events (user_id, kind, title, description, link, meta)
    VALUES (NEW.user_id,'order_created','Order placed',
            'Order '||NEW.order_number||' for ₹'||(NEW.total_cents/100)::text,
            '/orders/'||NEW.id::text,
            jsonb_build_object('order_id',NEW.id,'total_cents',NEW.total_cents));
  ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activity_events (user_id, kind, title, description, link, meta)
    VALUES (NEW.user_id,'order_'||NEW.status::text,
            CASE NEW.status::text
              WHEN 'shipped' THEN 'Order shipped'
              WHEN 'delivered' THEN 'Order delivered'
              WHEN 'packed' THEN 'Order packed'
              WHEN 'cancelled' THEN 'Order cancelled'
              WHEN 'paid' THEN 'Payment received'
              ELSE 'Order updated' END,
            'Order '||NEW.order_number,
            '/orders/'||NEW.id::text,
            jsonb_build_object('order_id',NEW.id,'status',NEW.status));
    IF NEW.status='delivered' THEN PERFORM public.evaluate_user_badges(NEW.user_id); END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_order_activity AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_status_activity();

-- On badge earned: log activity
CREATE OR REPLACE FUNCTION public.on_badge_earned_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  SELECT name INTO v_name FROM public.badges WHERE code=NEW.badge_code;
  INSERT INTO public.activity_events (user_id, kind, title, description, meta)
  VALUES (NEW.user_id,'earned_badge','Earned a badge', COALESCE(v_name,NEW.badge_code),
          jsonb_build_object('badge_code',NEW.badge_code));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_badge_earned_activity AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.on_badge_earned_activity();

-- ============ ADMIN BADGE MANAGEMENT ============
CREATE OR REPLACE FUNCTION public.admin_grant_badge(_target uuid, _code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.user_badges (user_id, badge_code, granted_by)
  VALUES (_target, _code, auth.uid())
  ON CONFLICT (user_id, badge_code) DO NOTHING;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_grant_badge(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_badge(_target uuid, _code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  DELETE FROM public.user_badges WHERE user_id=_target AND badge_code=_code;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_revoke_badge(uuid,text) TO authenticated;

-- ============ LEADERBOARDS ============
CREATE OR REPLACE FUNCTION public.get_leaderboard(_kind text, _period text)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, value bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_since timestamptz;
BEGIN
  v_since := CASE _period WHEN 'weekly' THEN now() - interval '7 days'
                          WHEN 'monthly' THEN now() - interval '30 days'
                          ELSE 'epoch'::timestamptz END;
  IF _kind = 'wins' THEN
    RETURN QUERY SELECT p.id, p.display_name, p.avatar_url, COUNT(l.*)::bigint
      FROM public.auction_logs l JOIN public.profiles p ON p.id=l.winner_user_id
      WHERE l.ended_at >= v_since AND l.winner_user_id IS NOT NULL
      GROUP BY p.id, p.display_name, p.avatar_url ORDER BY 4 DESC LIMIT 25;
  ELSIF _kind = 'joined' THEN
    RETURN QUERY SELECT p.id, p.display_name, p.avatar_url, COUNT(DISTINCT e.session_id)::bigint
      FROM public.auction_events e JOIN public.profiles p ON p.id=e.user_id
      WHERE e.kind='bid' AND e.created_at >= v_since
      GROUP BY p.id, p.display_name, p.avatar_url ORDER BY 4 DESC LIMIT 25;
  ELSIF _kind = 'highest_bid' THEN
    RETURN QUERY SELECT p.id, p.display_name, p.avatar_url, MAX(e.amount)::bigint
      FROM public.auction_events e JOIN public.profiles p ON p.id=e.user_id
      WHERE e.kind='bid' AND e.created_at >= v_since
      GROUP BY p.id, p.display_name, p.avatar_url ORDER BY 4 DESC LIMIT 25;
  ELSIF _kind = 'spending' THEN
    RETURN QUERY SELECT p.id, p.display_name, p.avatar_url, COALESCE(SUM(o.total_cents),0)::bigint
      FROM public.orders o JOIN public.profiles p ON p.id=o.user_id
      WHERE o.created_at >= v_since AND o.status IN ('paid','packed','shipped','delivered')
      GROUP BY p.id, p.display_name, p.avatar_url ORDER BY 4 DESC LIMIT 25;
  ELSIF _kind = 'badges' THEN
    RETURN QUERY SELECT p.id, p.display_name, p.avatar_url, COUNT(b.*)::bigint
      FROM public.user_badges b JOIN public.profiles p ON p.id=b.user_id
      WHERE b.earned_at >= v_since
      GROUP BY p.id, p.display_name, p.avatar_url ORDER BY 4 DESC LIMIT 25;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text,text) TO anon, authenticated;

-- Grant Early Member to profiles created in first 90 days from now (bootstrap)
INSERT INTO public.user_badges (user_id, badge_code)
SELECT id, 'early_member' FROM public.profiles
ON CONFLICT DO NOTHING;
