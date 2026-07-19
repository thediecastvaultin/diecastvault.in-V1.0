
-- 1. archived_at on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_archived_at ON public.orders (archived_at);

-- 2. order_logs table
CREATE TABLE IF NOT EXISTS public.order_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id UUID,
  order_number TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  actor_id UUID,
  actor_email TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  snapshot JSONB
);
CREATE INDEX IF NOT EXISTS idx_order_logs_order_id ON public.order_logs (order_id);
CREATE INDEX IF NOT EXISTS idx_order_logs_created_at ON public.order_logs (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_logs TO authenticated;
GRANT ALL ON public.order_logs TO service_role;

ALTER TABLE public.order_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read order logs" ON public.order_logs;
CREATE POLICY "Staff can read order logs" ON public.order_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

DROP POLICY IF EXISTS "Staff can insert order logs" ON public.order_logs;
CREATE POLICY "Staff can insert order logs" ON public.order_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- 3. write_order_log function + trigger fns
CREATE OR REPLACE FUNCTION public.build_order_snapshot(_order public.orders)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_items JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_name', product_name,
    'product_series', product_series,
    'product_image', product_image,
    'quantity', quantity,
    'unit_price_cents', unit_price_cents,
    'line_total_cents', line_total_cents
  ) ORDER BY id), '[]'::jsonb)
  INTO v_items FROM public.order_items WHERE order_id = _order.id;
  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'order_number', _order.order_number,
      'status', _order.status,
      'payment_status', _order.payment_status,
      'payment_method', _order.payment_method,
      'contact_email', _order.contact_email,
      'shipping_address', _order.shipping_address,
      'notes', _order.notes,
      'admin_notes', _order.admin_notes,
      'tracking_number', _order.tracking_number,
      'tracking_url', _order.tracking_url,
      'coupon_code', _order.coupon_code,
      'subtotal_cents', _order.subtotal_cents,
      'discount_cents', _order.discount_cents,
      'tax_cents', _order.tax_cents,
      'shipping_cents', _order.shipping_cents,
      'total_cents', _order.total_cents,
      'created_at', _order.created_at,
      'archived_at', _order.archived_at
    ),
    'items', v_items
  );
END; $$;

CREATE OR REPLACE FUNCTION public.log_order_event(
  _order public.orders, _action TEXT, _prev JSONB, _new JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_email TEXT;
  v_actor_name TEXT;
  v_customer_name TEXT;
  v_addr JSONB := _order.shipping_address;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT u.email::text, COALESCE(p.display_name, split_part(u.email::text,'@',1))
    INTO v_actor_email, v_actor_name
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = v_actor;
  END IF;
  IF v_addr IS NOT NULL THEN
    v_customer_name := NULLIF(v_addr->>'full_name','');
  END IF;
  IF v_customer_name IS NULL AND _order.user_id IS NOT NULL THEN
    SELECT display_name INTO v_customer_name FROM public.profiles WHERE id = _order.user_id;
  END IF;
  INSERT INTO public.order_logs (
    order_id, order_number, customer_name, customer_email,
    actor_id, actor_email, actor_name, action, previous_value, new_value, snapshot
  ) VALUES (
    _order.id, _order.order_number, v_customer_name, _order.contact_email,
    v_actor, v_actor_email, v_actor_name, _action, _prev, _new,
    public.build_order_snapshot(_order)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.on_order_insert_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_order_event(NEW, 'order.created', NULL,
    jsonb_build_object('total_cents', NEW.total_cents, 'status', NEW.status));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.on_order_update_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_order_event(NEW, 'order.status_changed',
      to_jsonb(OLD.status::text), to_jsonb(NEW.status::text));
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    PERFORM public.log_order_event(NEW, 'payment.status_changed',
      to_jsonb(OLD.payment_status::text), to_jsonb(NEW.payment_status::text));
  END IF;
  IF COALESCE(NEW.tracking_number,'') IS DISTINCT FROM COALESCE(OLD.tracking_number,'')
     OR COALESCE(NEW.tracking_url,'') IS DISTINCT FROM COALESCE(OLD.tracking_url,'') THEN
    PERFORM public.log_order_event(NEW,
      CASE WHEN COALESCE(OLD.tracking_number,'')='' AND COALESCE(NEW.tracking_number,'')<>'' THEN 'tracking.added'
           WHEN COALESCE(NEW.tracking_number,'')='' THEN 'tracking.removed'
           ELSE 'tracking.updated' END,
      jsonb_build_object('tracking_number', OLD.tracking_number, 'tracking_url', OLD.tracking_url),
      jsonb_build_object('tracking_number', NEW.tracking_number, 'tracking_url', NEW.tracking_url));
  END IF;
  IF COALESCE(NEW.notes,'') IS DISTINCT FROM COALESCE(OLD.notes,'') THEN
    PERFORM public.log_order_event(NEW, 'customer_note.updated',
      to_jsonb(OLD.notes), to_jsonb(NEW.notes));
  END IF;
  IF COALESCE(NEW.admin_notes,'') IS DISTINCT FROM COALESCE(OLD.admin_notes,'') THEN
    PERFORM public.log_order_event(NEW, 'staff_note.updated',
      to_jsonb(OLD.admin_notes), to_jsonb(NEW.admin_notes));
  END IF;
  IF COALESCE(NEW.coupon_code,'') IS DISTINCT FROM COALESCE(OLD.coupon_code,'') THEN
    PERFORM public.log_order_event(NEW,
      CASE WHEN COALESCE(OLD.coupon_code,'')='' THEN 'coupon.applied'
           WHEN COALESCE(NEW.coupon_code,'')='' THEN 'coupon.removed'
           ELSE 'coupon.changed' END,
      to_jsonb(OLD.coupon_code), to_jsonb(NEW.coupon_code));
  END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    PERFORM public.log_order_event(NEW,
      CASE WHEN NEW.archived_at IS NOT NULL THEN 'order.archived' ELSE 'order.restored' END,
      to_jsonb(OLD.archived_at), to_jsonb(NEW.archived_at));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.on_order_delete_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_order_event(OLD, 'order.permanently_deleted', NULL, NULL);
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_orders_audit_ins ON public.orders;
CREATE TRIGGER trg_orders_audit_ins AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_insert_log();

DROP TRIGGER IF EXISTS trg_orders_audit_upd ON public.orders;
CREATE TRIGGER trg_orders_audit_upd AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_update_log();

DROP TRIGGER IF EXISTS trg_orders_audit_del ON public.orders;
CREATE TRIGGER trg_orders_audit_del BEFORE DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_delete_log();
