
-- Admin/staff helper functions
CREATE OR REPLACE FUNCTION public.admin_list_customers()
RETURNS TABLE (user_id uuid, email text, display_name text, order_count bigint, total_spent_cents bigint, last_order_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, u.email::text, p.display_name, COUNT(o.id), COALESCE(SUM(o.total_cents), 0), MAX(o.created_at)
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.orders o ON o.user_id = p.id
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  GROUP BY p.id, u.email, p.display_name
  ORDER BY COALESCE(SUM(o.total_cents),0) DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_list_customers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_customers() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_role(_target_user uuid, _role app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user, _role) ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target_user AND role = _role;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, app_role, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_role_by_email(_email text, _role app_role, _grant boolean)
RETURNS TABLE(user_id uuid, email text, granted boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE _target uuid; _confirmed timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT u.id, u.email_confirmed_at INTO _target, _confirmed FROM auth.users AS u
   WHERE lower(u.email) = lower(trim(_email)) LIMIT 1;
  IF _target IS NULL THEN RAISE EXCEPTION 'no user found with email %', _email; END IF;
  IF _confirmed IS NULL THEN RAISE EXCEPTION 'user % has not confirmed their email yet', _email; END IF;
  IF _grant THEN
    INSERT INTO public.user_roles AS ur (user_id, role) VALUES (_target, _role)
    ON CONFLICT ON CONSTRAINT user_roles_user_id_role_key DO NOTHING;
  ELSE
    DELETE FROM public.user_roles AS ur WHERE ur.user_id = _target AND ur.role = _role;
  END IF;
  RETURN QUERY SELECT _target, lower(trim(_email)), _grant;
END; $$;
REVOKE ALL ON FUNCTION public.admin_grant_role_by_email(text, app_role, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_role_by_email(text, app_role, boolean) TO authenticated, service_role;

-- Staff policies
CREATE POLICY "Staff can add products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff can edit products" ON public.products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'staff')) WITH CHECK (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff view all orders" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff view all order items" ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff read notifications" ON public.admin_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff read audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff view coupons" ON public.coupons FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can moderate reviews" ON public.reviews FOR UPDATE
  USING (public.has_role(auth.uid(), 'staff')) WITH CHECK (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff can delete reviews" ON public.reviews FOR DELETE
  USING (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Buyers create reviews" ON public.reviews FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = reviews.product_id AND o.user_id = auth.uid()
  )
);

-- Product costs
CREATE TABLE public.product_costs (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_costs TO authenticated;
GRANT ALL ON public.product_costs TO service_role;
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can view costs" ON public.product_costs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff and admins can insert costs" ON public.product_costs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff and admins can update costs" ON public.product_costs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Admins can delete costs" ON public.product_costs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER product_costs_set_updated_at BEFORE UPDATE ON public.product_costs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Site settings
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Staff or admin can insert site settings" ON public.site_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff or admin can update site settings" ON public.site_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER site_settings_set_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.site_settings (key, value) VALUES ('coming_soon_mode', 'false'::jsonb);

-- Product categories
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Staff and admins can insert categories" ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff and admins can update categories" ON public.product_categories FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Admins can delete categories" ON public.product_categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER product_categories_set_updated_at BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.product_categories (slug, name, sort_order)
VALUES ('hot-wheels', 'Hot Wheels', 10), ('accessories', 'Accessories', 20);

ALTER TABLE public.products
  ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN coming_soon boolean NOT NULL DEFAULT false;
UPDATE public.products SET category_id = (SELECT id FROM public.product_categories WHERE slug = 'hot-wheels') WHERE category_id IS NULL;
CREATE INDEX products_category_id_idx ON public.products(category_id);

-- Auction events
CREATE TABLE public.auction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-blue-500/80',
  kind TEXT NOT NULL CHECK (kind IN ('bid','msg','system')),
  text TEXT, amount INTEGER, tone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auction_events_session_created_idx ON public.auction_events (session_id, created_at);
GRANT SELECT ON public.auction_events TO anon, authenticated;
GRANT INSERT ON public.auction_events TO authenticated;
GRANT ALL ON public.auction_events TO service_role;
ALTER TABLE public.auction_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read auction events" ON public.auction_events FOR SELECT USING (true);
CREATE POLICY "Authenticated users insert their own events" ON public.auction_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

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
REVOKE ALL ON FUNCTION public.auction_bid_reset_timer() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_auction_bid_reset_timer AFTER INSERT ON public.auction_events
FOR EACH ROW EXECUTE FUNCTION public.auction_bid_reset_timer();

ALTER TABLE public.auction_events REPLICA IDENTITY FULL;
ALTER TABLE public.site_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;

CREATE OR REPLACE FUNCTION public.auction_finalize_if_expired()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_value JSONB; v_status TEXT; v_expires TIMESTAMPTZ; v_session UUID; v_top RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT value INTO v_value FROM public.site_settings WHERE key = 'active_auction' FOR UPDATE;
  IF v_value IS NULL THEN RETURN FALSE; END IF;
  v_status := v_value->>'status';
  v_expires := NULLIF(v_value->>'expiresAt','')::timestamptz;
  v_session := NULLIF(v_value->>'sessionId','')::uuid;
  IF v_status <> 'live' OR v_expires IS NULL OR v_expires > now() THEN RETURN FALSE; END IF;
  UPDATE public.site_settings
     SET value = jsonb_set(jsonb_set(value, '{status}', to_jsonb('closed'::text), true),
                           '{closedAt}', to_jsonb(to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true),
         updated_at = now()
   WHERE key = 'active_auction';
  IF v_session IS NOT NULL THEN
    SELECT display_name, amount INTO v_top FROM public.auction_events
     WHERE session_id = v_session AND kind = 'bid' ORDER BY amount DESC, created_at DESC LIMIT 1;
    INSERT INTO public.auction_events (session_id, user_id, display_name, color, kind, text, tone)
    VALUES (v_session, auth.uid(), 'System', 'bg-violet-500/80', 'system',
            CASE WHEN v_top.display_name IS NOT NULL
                 THEN 'Auction Closed. Winner: ' || v_top.display_name || ' at ₹' || v_top.amount::text
                 ELSE 'Auction Closed. No bids placed.' END, 'success');
  END IF;
  RETURN TRUE;
END; $$;
REVOKE ALL ON FUNCTION public.auction_finalize_if_expired() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_finalize_if_expired() TO authenticated;

-- Auction drafts
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
CREATE POLICY "staff can manage auction drafts" ON public.auction_drafts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER auction_drafts_updated_at BEFORE UPDATE ON public.auction_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auction logs
CREATE TABLE public.auction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  product_name TEXT NOT NULL,
  brand TEXT, series TEXT, scale TEXT, image_url TEXT,
  winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_name TEXT, winning_bid INTEGER,
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
CREATE POLICY "staff can manage auction logs" ON public.auction_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE OR REPLACE FUNCTION public.finalize_active_auction()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_value JSONB; v_session UUID; v_top RECORD;
  v_participants INTEGER; v_total_bids INTEGER; v_bid_history JSONB;
  v_started TIMESTAMPTZ; v_log_id UUID; v_closer_name TEXT;
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
  INSERT INTO public.auction_logs (
    session_id, product_name, brand, series, scale, image_url,
    winner_user_id, winner_name, winning_bid, total_bids, participant_count,
    started_at, ended_at, duration_seconds, status, closed_by_user_id, closed_by_name, bid_history
  ) VALUES (
    v_session, v_value->>'productName', v_value->>'brand', v_value->>'series', v_value->>'scale',
    (v_value->'images'->>0), v_top.user_id, v_top.display_name, v_top.amount,
    COALESCE(v_total_bids,0), COALESCE(v_participants,0), v_started, now(),
    CASE WHEN v_started IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - v_started))::int END,
    'closed', auth.uid(), v_closer_name, v_bid_history
  ) RETURNING id INTO v_log_id;
  UPDATE public.site_settings
     SET value = jsonb_set(jsonb_set(value, '{status}', to_jsonb('closed'::text), true),
                           '{closedAt}', to_jsonb(to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true),
         updated_at = now()
   WHERE key='active_auction';
  RETURN v_log_id;
END; $$;
REVOKE ALL ON FUNCTION public.finalize_active_auction() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_active_auction() TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_active_auction()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_session UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT NULLIF(value->>'sessionId','')::uuid INTO v_session FROM public.site_settings WHERE key='active_auction';
  IF v_session IS NOT NULL THEN DELETE FROM public.auction_events WHERE session_id = v_session; END IF;
  DELETE FROM public.site_settings WHERE key='active_auction';
END; $$;
REVOKE ALL ON FUNCTION public.clear_active_auction() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_active_auction() TO authenticated;
