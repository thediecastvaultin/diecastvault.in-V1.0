
CREATE OR REPLACE FUNCTION public.admin_reset_scope(_scope text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_count bigint := 0;
BEGIN
  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT email::text INTO v_actor_email FROM auth.users WHERE id = v_actor;

  CASE _scope
    WHEN 'notifications' THEN
      DELETE FROM public.admin_notifications;
      GET DIAGNOSTICS v_count = ROW_COUNT;
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_scope(text) TO authenticated;
