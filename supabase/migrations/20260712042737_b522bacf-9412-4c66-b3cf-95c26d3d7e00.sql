
-- PRODUCTS: status + SEO
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text;

-- Update public product policy so drafts stay hidden. Recreate to be safe.
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Published products are viewable by everyone"
  ON public.products FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

-- ORDERS: tracking + admin notes
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- REVIEWS: approval flag
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- Recreate public reviews SELECT to filter unapproved
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Approved reviews viewable by everyone"
  ON public.reviews FOR SELECT
  USING (approved = true OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Admins can update/delete any review (moderation)
DROP POLICY IF EXISTS "Admins can moderate reviews" ON public.reviews;
CREATE POLICY "Admins can moderate reviews"
  ON public.reviews FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete reviews"
  ON public.reviews FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ COUPONS ============
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  min_order_cents integer NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can lookup active coupons"
  ON public.coupons FOR SELECT TO authenticated
  USING (active = true);
CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Store applied coupon on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0;

-- ============ AUDIT LOG ============
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at DESC);

-- ============ NOTIFICATIONS (admin-only) ============
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read notifications"
  ON public.admin_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update notifications"
  ON public.admin_notifications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System inserts notifications"
  ON public.admin_notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS admin_notifications_created_idx ON public.admin_notifications (created_at DESC);

-- Low-stock trigger: when stock drops to/under threshold, insert a notification
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stock_quantity <= NEW.low_stock_threshold
     AND (OLD.stock_quantity > NEW.low_stock_threshold OR TG_OP = 'INSERT') THEN
    INSERT INTO public.admin_notifications (kind, title, body, link)
    VALUES (
      CASE WHEN NEW.stock_quantity = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
      CASE WHEN NEW.stock_quantity = 0 THEN NEW.name || ' is out of stock' ELSE NEW.name || ' is low on stock' END,
      'Only ' || NEW.stock_quantity || ' left (threshold ' || NEW.low_stock_threshold || ')',
      '/shop/' || NEW.slug
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_low_stock ON public.products;
CREATE TRIGGER trg_products_low_stock
  AFTER INSERT OR UPDATE OF stock_quantity ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();

-- Helper: list all customers with stats (admins)
CREATE OR REPLACE FUNCTION public.admin_list_customers()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  order_count bigint,
  total_spent_cents bigint,
  last_order_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    u.email::text AS email,
    p.display_name,
    COUNT(o.id) AS order_count,
    COALESCE(SUM(o.total_cents), 0) AS total_spent_cents,
    MAX(o.created_at) AS last_order_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.orders o ON o.user_id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY p.id, u.email, p.display_name
  ORDER BY total_spent_cents DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_customers() TO authenticated;

-- Helper: grant/revoke roles from admin UI
CREATE OR REPLACE FUNCTION public.admin_set_role(_target_user uuid, _role app_role, _grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target_user AND role = _role;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role, boolean) TO authenticated;
