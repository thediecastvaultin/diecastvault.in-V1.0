
-- 1) Soft-delete flag
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_archived_at_idx ON public.orders (archived_at);

-- 2) Order logs table
CREATE TABLE IF NOT EXISTS public.order_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid,
  order_number text NOT NULL,
  customer_name text,
  customer_email text,
  actor_id uuid,
  actor_email text,
  actor_name text,
  action text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS order_logs_order_id_idx ON public.order_logs (order_id);
CREATE INDEX IF NOT EXISTS order_logs_created_at_idx ON public.order_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS order_logs_action_idx ON public.order_logs (action);

GRANT SELECT, INSERT ON public.order_logs TO authenticated;
GRANT ALL ON public.order_logs TO service_role;

ALTER TABLE public.order_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read order logs" ON public.order_logs;
CREATE POLICY "Staff can read order logs" ON public.order_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "Staff can write order logs" ON public.order_logs;
CREATE POLICY "Staff can write order logs" ON public.order_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- 3) Helper: build snapshot for an order id (order + items)
CREATE OR REPLACE FUNCTION public.build_order_snapshot(_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'order', to_jsonb(o.*),
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(oi.*) ORDER BY oi.id)
      FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o WHERE o.id = _order_id;
$$;

-- 4) Central log-writer
CREATE OR REPLACE FUNCTION public.write_order_log(
  _order_id uuid,
  _order_number text,
  _action text,
  _previous jsonb,
  _new jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_actor_name text;
  v_cust_name text;
  v_cust_email text;
  v_snapshot jsonb;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT u.email::text, COALESCE(p.display_name, split_part(u.email::text,'@',1))
      INTO v_actor_email, v_actor_name
      FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
     WHERE u.id = v_actor;
  END IF;

  SELECT
    COALESCE(p.display_name, o.shipping_address->>'full_name'),
    o.contact_email
    INTO v_cust_name, v_cust_email
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.id = _order_id;

  v_snapshot := public.build_order_snapshot(_order_id);
  IF v_snapshot IS NULL THEN
    -- order is being deleted; capture from _new / _previous
    v_snapshot := COALESCE(_new, _previous, '{}'::jsonb);
  END IF;

  INSERT INTO public.order_logs (
    order_id, order_number, customer_name, customer_email,
    actor_id, actor_email, actor_name,
    action, previous_value, new_value, snapshot
  ) VALUES (
    _order_id, _order_number, v_cust_name, v_cust_email,
    v_actor, v_actor_email, v_actor_name,
    _action, _previous, _new, v_snapshot
  );
END; $$;

-- 5) Trigger fn on orders
CREATE OR REPLACE FUNCTION public.orders_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_order_log(NEW.id, NEW.order_number, 'order.created', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.write_order_log(NEW.id, NEW.order_number, 'order.status_changed',
        jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status));
    END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      PERFORM public.write_order_log(NEW.id, NEW.order_number, 'payment.status_changed',
        jsonb_build_object('payment_status', OLD.payment_status), jsonb_build_object('payment_status', NEW.payment_status));
    END IF;
    IF COALESCE(NEW.tracking_number,'') IS DISTINCT FROM COALESCE(OLD.tracking_number,'') OR
       COALESCE(NEW.tracking_url,'')    IS DISTINCT FROM COALESCE(OLD.tracking_url,'') THEN
      PERFORM public.write_order_log(NEW.id, NEW.order_number,
        CASE WHEN COALESCE(OLD.tracking_number,'') = '' AND COALESCE(NEW.tracking_number,'') <> '' THEN 'tracking.added'
             WHEN COALESCE(NEW.tracking_number,'') = '' THEN 'tracking.removed'
             ELSE 'tracking.updated' END,
        jsonb_build_object('tracking_number', OLD.tracking_number, 'tracking_url', OLD.tracking_url),
        jsonb_build_object('tracking_number', NEW.tracking_number, 'tracking_url', NEW.tracking_url));
    END IF;
    IF COALESCE(NEW.admin_notes,'') IS DISTINCT FROM COALESCE(OLD.admin_notes,'') THEN
      PERFORM public.write_order_log(NEW.id, NEW.order_number, 'staff_note.updated',
        jsonb_build_object('admin_notes', OLD.admin_notes), jsonb_build_object('admin_notes', NEW.admin_notes));
    END IF;
    IF COALESCE(NEW.notes,'') IS DISTINCT FROM COALESCE(OLD.notes,'') THEN
      PERFORM public.write_order_log(NEW.id, NEW.order_number, 'customer_note.updated',
        jsonb_build_object('notes', OLD.notes), jsonb_build_object('notes', NEW.notes));
    END IF;
    IF COALESCE(NEW.coupon_code,'') IS DISTINCT FROM COALESCE(OLD.coupon_code,'') THEN
      PERFORM public.write_order_log(NEW.id, NEW.order_number,
        CASE WHEN COALESCE(OLD.coupon_code,'') = '' THEN 'coupon.applied'
             WHEN COALESCE(NEW.coupon_code,'') = '' THEN 'coupon.removed'
             ELSE 'coupon.changed' END,
        jsonb_build_object('coupon_code', OLD.coupon_code, 'discount_cents', OLD.discount_cents),
        jsonb_build_object('coupon_code', NEW.coupon_code, 'discount_cents', NEW.discount_cents));
    END IF;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      PERFORM public.write_order_log(NEW.id, NEW.order_number,
        CASE WHEN NEW.archived_at IS NOT NULL THEN 'order.archived' ELSE 'order.restored' END,
        jsonb_build_object('archived_at', OLD.archived_at),
        jsonb_build_object('archived_at', NEW.archived_at));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_order_log(OLD.id, OLD.order_number, 'order.permanently_deleted', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_orders_audit_ins ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_audit_upd ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_audit_del ON public.orders;

CREATE TRIGGER trg_orders_audit_ins AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_audit_trigger();
CREATE TRIGGER trg_orders_audit_upd AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_audit_trigger();
CREATE TRIGGER trg_orders_audit_del BEFORE DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_audit_trigger();
