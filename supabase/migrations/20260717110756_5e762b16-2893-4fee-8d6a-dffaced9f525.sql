
-- 1. Add per-customer purchase limit to products (0 = unlimited)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS max_per_customer INTEGER NOT NULL DEFAULT 0;

-- 2. Function to re-link legacy orders to the current user by contact_email
CREATE OR REPLACE FUNCTION public.link_my_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_uid UUID;
  v_count INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR v_email = '' THEN RETURN 0; END IF;
  WITH updated AS (
    UPDATE public.orders
       SET user_id = v_uid
     WHERE lower(contact_email) = lower(v_email)
       AND user_id IS DISTINCT FROM v_uid
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN COALESCE(v_count, 0);
END; $$;

GRANT EXECUTE ON FUNCTION public.link_my_orders() TO authenticated;

-- 3. Disable automatic badge awarding — badges are now fully staff-managed
CREATE OR REPLACE FUNCTION public.evaluate_user_badges(_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Badges are now managed manually by staff; automatic awarding disabled.
  RETURN;
END; $$;

-- 4. Function to enforce per-customer purchase limits at checkout
CREATE OR REPLACE FUNCTION public.check_purchase_limit(_product_id uuid, _requested_qty integer)
RETURNS TABLE(allowed boolean, limit_per_customer integer, already_purchased integer, product_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_limit int; v_prev int; v_name text;
BEGIN
  SELECT COALESCE(max_per_customer,0), name INTO v_limit, v_name
    FROM public.products WHERE id = _product_id;
  IF v_limit IS NULL OR v_limit <= 0 THEN
    RETURN QUERY SELECT TRUE, 0, 0, v_name; RETURN;
  END IF;
  SELECT COALESCE(SUM(oi.quantity), 0)::int INTO v_prev
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
   WHERE o.user_id = auth.uid()
     AND oi.product_id = _product_id
     AND o.status <> 'cancelled';
  RETURN QUERY SELECT (v_prev + _requested_qty) <= v_limit, v_limit, v_prev, v_name;
END; $$;

GRANT EXECUTE ON FUNCTION public.check_purchase_limit(uuid, integer) TO authenticated;
