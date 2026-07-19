-- Grant/revoke role by email (admin-only, verified emails only)
CREATE OR REPLACE FUNCTION public.admin_grant_role_by_email(_email text, _role app_role, _grant boolean)
RETURNS TABLE(user_id uuid, email text, granted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid;
  _confirmed timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT u.id, u.email_confirmed_at
    INTO _target, _confirmed
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(_email))
  LIMIT 1;

  IF _target IS NULL THEN
    RAISE EXCEPTION 'no user found with email %', _email;
  END IF;

  IF _confirmed IS NULL THEN
    RAISE EXCEPTION 'user % has not confirmed their email yet', _email;
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_roles.user_id = _target AND role = _role;
  END IF;

  RETURN QUERY SELECT _target, lower(trim(_email)), _grant;
END;
$$;

-- Broaden customer roster to admins OR staff
CREATE OR REPLACE FUNCTION public.admin_list_customers()
RETURNS TABLE(user_id uuid, email text, display_name text, order_count bigint, total_spent_cents bigint, last_order_at timestamptz)
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
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  GROUP BY p.id, u.email, p.display_name
  ORDER BY total_spent_cents DESC;
$$;

-- Products: staff can add & edit (no delete)
CREATE POLICY "Staff can add products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff can edit products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'staff'));

-- Orders: staff read-only
CREATE POLICY "Staff view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff view all order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

-- Notifications, audit log, coupons: staff read-only
CREATE POLICY "Staff read notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff read audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff view coupons"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

-- User roles: staff & admin can read the whole roster
CREATE POLICY "Staff and admins view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));