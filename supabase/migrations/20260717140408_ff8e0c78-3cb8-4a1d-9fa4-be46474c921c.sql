
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS max_uses_per_person INTEGER,
  ADD COLUMN IF NOT EXISTS first_x_customers INTEGER,
  ADD COLUMN IF NOT EXISTS max_discount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own redemptions" ON public.coupon_redemptions;
CREATE POLICY "users read own redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "users insert own redemptions" ON public.coupon_redemptions;
CREATE POLICY "users insert own redemptions" ON public.coupon_redemptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code_user ON public.coupon_redemptions(coupon_code, user_id);

CREATE OR REPLACE FUNCTION public.validate_coupon(_code TEXT, _subtotal_cents INTEGER)
RETURNS TABLE(
  valid BOOLEAN,
  reason TEXT,
  code TEXT,
  discount_type TEXT,
  discount_value INTEGER,
  discount_cents INTEGER,
  min_order_cents INTEGER,
  max_discount_cents INTEGER
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_uid UUID := auth.uid();
  v_used_by_user INTEGER := 0;
  v_calc INTEGER := 0;
BEGIN
  SELECT * INTO c FROM public.coupons WHERE upper(coupons.code) = upper(_code) LIMIT 1;
  IF c.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid coupon', _code, ''::text, 0, 0, 0, 0; RETURN;
  END IF;
  IF NOT c.active THEN
    RETURN QUERY SELECT FALSE, 'Coupon is not active', c.code, c.discount_type, c.discount_value, 0, c.min_order_cents, COALESCE(c.max_discount_cents,0); RETURN;
  END IF;
  IF c.valid_from IS NOT NULL AND c.valid_from > now() THEN
    RETURN QUERY SELECT FALSE, 'Coupon not yet valid', c.code, c.discount_type, c.discount_value, 0, c.min_order_cents, COALESCE(c.max_discount_cents,0); RETURN;
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT FALSE, 'Coupon expired', c.code, c.discount_type, c.discount_value, 0, c.min_order_cents, COALESCE(c.max_discount_cents,0); RETURN;
  END IF;
  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN
    RETURN QUERY SELECT FALSE, 'Coupon fully redeemed', c.code, c.discount_type, c.discount_value, 0, c.min_order_cents, COALESCE(c.max_discount_cents,0); RETURN;
  END IF;
  IF c.first_x_customers IS NOT NULL AND c.used_count >= c.first_x_customers THEN
    RETURN QUERY SELECT FALSE, 'Only the first ' || c.first_x_customers || ' customers could use this', c.code, c.discount_type, c.discount_value, 0, c.min_order_cents, COALESCE(c.max_discount_cents,0); RETURN;
  END IF;
  IF _subtotal_cents < c.min_order_cents THEN
    RETURN QUERY SELECT FALSE, 'Minimum order not met', c.code, c.discount_type, c.discount_value, 0, c.min_order_cents, COALESCE(c.max_discount_cents,0); RETURN;
  END IF;
  IF v_uid IS NOT NULL AND c.max_uses_per_person IS NOT NULL THEN
    SELECT COUNT(*) INTO v_used_by_user FROM public.coupon_redemptions r WHERE upper(r.coupon_code)=upper(c.code) AND r.user_id = v_uid;
    IF v_used_by_user >= c.max_uses_per_person THEN
      RETURN QUERY SELECT FALSE, 'You have already used this coupon the maximum times', c.code, c.discount_type, c.discount_value, 0, c.min_order_cents, COALESCE(c.max_discount_cents,0); RETURN;
    END IF;
  END IF;
  IF c.discount_type = 'percent' THEN
    v_calc := (_subtotal_cents * c.discount_value) / 100;
  ELSE
    v_calc := c.discount_value;
  END IF;
  IF c.max_discount_cents IS NOT NULL AND c.max_discount_cents > 0 AND v_calc > c.max_discount_cents THEN
    v_calc := c.max_discount_cents;
  END IF;
  IF v_calc > _subtotal_cents THEN v_calc := _subtotal_cents; END IF;
  RETURN QUERY SELECT TRUE, NULL::text, c.code, c.discount_type, c.discount_value, v_calc, c.min_order_cents, COALESCE(c.max_discount_cents,0);
END;
$$;
