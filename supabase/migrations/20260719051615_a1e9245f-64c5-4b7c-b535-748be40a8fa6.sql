
-- Allow admin/staff to delete notifications
DROP POLICY IF EXISTS "Admins delete notifications" ON public.admin_notifications;
CREATE POLICY "Admins delete notifications" ON public.admin_notifications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Server-side count for master reset scopes (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.admin_count_scope(_scope text)
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count bigint := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  CASE _scope
    WHEN 'notifications' THEN
      SELECT (SELECT COUNT(*) FROM public.admin_notifications)
           + (SELECT COUNT(*) FROM public.announcements WHERE channel = 'notification')
        INTO v_count;
    WHEN 'flash_announcements' THEN SELECT COUNT(*) INTO v_count FROM public.announcements WHERE channel='flash';
    WHEN 'activity_events'    THEN SELECT COUNT(*) INTO v_count FROM public.activity_events;
    WHEN 'reviews'            THEN SELECT COUNT(*) INTO v_count FROM public.reviews;
    WHEN 'coupons'            THEN SELECT COUNT(*) INTO v_count FROM public.coupons;
    WHEN 'coupon_usage'       THEN SELECT COUNT(*) INTO v_count FROM public.coupon_redemptions;
    WHEN 'active_orders'      THEN SELECT COUNT(*) INTO v_count FROM public.orders WHERE archived_at IS NULL;
    WHEN 'archived_orders'    THEN SELECT COUNT(*) INTO v_count FROM public.orders WHERE archived_at IS NOT NULL;
    WHEN 'order_logs'         THEN SELECT COUNT(*) INTO v_count FROM public.order_logs;
    WHEN 'auction_history'    THEN SELECT COUNT(*) INTO v_count FROM public.auction_events;
    WHEN 'auction_logs'       THEN SELECT COUNT(*) INTO v_count FROM public.auction_logs;
    WHEN 'auction_winners'    THEN SELECT COUNT(*) INTO v_count FROM public.auction_logs WHERE winner_user_id IS NOT NULL;
    WHEN 'badge_assignments'  THEN SELECT COUNT(*) INTO v_count FROM public.user_badges;
    WHEN 'wishlist'           THEN SELECT COUNT(*) INTO v_count FROM public.wishlist;
    WHEN 'carts'              THEN SELECT COUNT(*) INTO v_count FROM public.cart_items;
    ELSE v_count := 0;
  END CASE;
  RETURN COALESCE(v_count, 0);
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_count_scope(text) TO authenticated;

-- Merge notification-channel announcements into the 'notifications' reset scope
CREATE OR REPLACE FUNCTION public.admin_reset_scope(_scope text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_count bigint := 0;
  v_extra bigint := 0;
BEGIN
  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT email::text INTO v_actor_email FROM auth.users WHERE id = v_actor;

  CASE _scope
    WHEN 'notifications' THEN
      DELETE FROM public.admin_notifications;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      DELETE FROM public.announcements WHERE channel = 'notification';
      GET DIAGNOSTICS v_extra = ROW_COUNT;
      v_count := v_count + v_extra;
    WHEN 'notification_announcements' THEN
      DELETE FROM public.announcements WHERE channel = 'notification';
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'flash_announcements' THEN
      DELETE FROM public.announcements WHERE channel = 'flash';
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'coupons' THEN
      DELETE FROM public.coupons;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'coupon_usage' THEN
      DELETE FROM public.coupon_redemptions;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      UPDATE public.coupons SET used_count = 0;
    WHEN 'active_orders' THEN
      DELETE FROM public.orders WHERE archived_at IS NULL;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'archived_orders' THEN
      DELETE FROM public.orders WHERE archived_at IS NOT NULL;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'order_logs' THEN
      DELETE FROM public.order_logs;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'auction_history' THEN
      DELETE FROM public.auction_events;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      DELETE FROM public.site_settings WHERE key = 'active_auction';
    WHEN 'auction_logs' THEN
      DELETE FROM public.auction_logs;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'auction_winners' THEN
      UPDATE public.auction_logs SET winner_user_id = NULL, winner_name = NULL, winner_email = NULL, winner_phone = NULL, winning_bid = NULL;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'badge_assignments' THEN
      DELETE FROM public.user_badges;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'activity_events' THEN
      DELETE FROM public.activity_events;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'wishlist' THEN
      DELETE FROM public.wishlist;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'carts' THEN
      DELETE FROM public.cart_items;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      DELETE FROM public.carts;
    WHEN 'reviews' THEN
      DELETE FROM public.reviews;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      RAISE EXCEPTION 'unknown scope: %', _scope;
  END CASE;

  INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, metadata)
  VALUES (v_actor, v_actor_email, 'master_reset', _scope, jsonb_build_object('scope', _scope, 'rows_affected', v_count));

  RETURN jsonb_build_object('scope', _scope, 'rows_affected', v_count);
END;
$function$;
