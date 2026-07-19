
CREATE OR REPLACE FUNCTION public.admin_prepare_production(
  _include_flash boolean DEFAULT false,
  _include_notifications boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_start timestamptz := clock_timestamp();
  v_counts jsonb := '{}'::jsonb;
  v_removed_users uuid[] := ARRAY[]::uuid[];
  v_c bigint;
  v_total bigint := 0;
BEGIN
  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT email::text INTO v_actor_email FROM auth.users WHERE id = v_actor;

  -- Notifications (bell + delivered notification announcements)
  DELETE FROM public.admin_notifications;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('notifications', v_c); v_total := v_total + v_c;

  IF _include_notifications THEN
    DELETE FROM public.announcements WHERE channel = 'notification';
    GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('notification_announcements', v_c); v_total := v_total + v_c;
  END IF;

  IF _include_flash THEN
    DELETE FROM public.announcements WHERE channel = 'flash';
    GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('flash_banner', v_c); v_total := v_total + v_c;
  END IF;

  DELETE FROM public.cart_items;   GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('cart_items', v_c); v_total := v_total + v_c;
  DELETE FROM public.carts;        GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('carts', v_c); v_total := v_total + v_c;
  DELETE FROM public.wishlist;     GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('wishlist', v_c); v_total := v_total + v_c;
  DELETE FROM public.reviews;      GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('reviews', v_c); v_total := v_total + v_c;
  DELETE FROM public.orders;       GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('orders', v_c); v_total := v_total + v_c;
  DELETE FROM public.order_logs;   GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('order_logs', v_c); v_total := v_total + v_c;
  DELETE FROM public.auction_events; GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('auction_events', v_c); v_total := v_total + v_c;
  DELETE FROM public.auction_logs; GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('auction_logs', v_c); v_total := v_total + v_c;
  DELETE FROM public.site_settings WHERE key = 'active_auction'; GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('active_auction', v_c); v_total := v_total + v_c;
  DELETE FROM public.coupon_redemptions; GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('coupon_redemptions', v_c); v_total := v_total + v_c;
  UPDATE public.coupons SET used_count = 0 WHERE used_count <> 0;
  DELETE FROM public.user_badges;  GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('user_badges', v_c); v_total := v_total + v_c;
  DELETE FROM public.activity_events; GET DIAGNOSTICS v_c = ROW_COUNT; v_counts := v_counts || jsonb_build_object('activity_events', v_c); v_total := v_total + v_c;

  -- Test customer accounts: profiles with no admin/staff role
  WITH candidates AS (
    SELECT p.id FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = p.id AND r.role IN ('admin','staff')
    )
  ),
  del_addr AS (DELETE FROM public.addresses WHERE user_id IN (SELECT id FROM candidates) RETURNING 1),
  del_prof AS (DELETE FROM public.profiles WHERE id IN (SELECT id FROM candidates) RETURNING id),
  del_roles AS (DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM candidates) RETURNING 1)
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_removed_users FROM del_prof;

  v_counts := v_counts || jsonb_build_object('test_customer_profiles', COALESCE(array_length(v_removed_users, 1), 0));
  v_total := v_total + COALESCE(array_length(v_removed_users, 1), 0);

  INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, metadata)
  VALUES (
    v_actor, v_actor_email, 'prepare_for_production', 'production_cleanup',
    jsonb_build_object(
      'counts', v_counts,
      'total_rows', v_total,
      'duration_ms', EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start))::int,
      'include_flash', _include_flash,
      'include_notifications', _include_notifications,
      'removed_auth_user_ids', to_jsonb(v_removed_users)
    )
  );

  RETURN jsonb_build_object(
    'counts', v_counts,
    'total_rows', v_total,
    'duration_ms', EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start))::int,
    'removed_auth_user_ids', to_jsonb(v_removed_users)
  );
END; $$;

-- Extend count helper to include activity_events (used by old master controls, keep working)
CREATE OR REPLACE FUNCTION public.admin_count_scope(_scope text)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHEN 'notification_history' THEN SELECT COUNT(*) INTO v_count FROM public.announcements WHERE channel='notification';
    WHEN 'flash_announcements' THEN SELECT COUNT(*) INTO v_count FROM public.announcements WHERE channel='flash';
    WHEN 'activity_events' THEN SELECT COUNT(*) INTO v_count FROM public.activity_events;
    WHEN 'reviews' THEN SELECT COUNT(*) INTO v_count FROM public.reviews;
    WHEN 'coupons' THEN SELECT COUNT(*) INTO v_count FROM public.coupons;
    WHEN 'coupon_usage' THEN SELECT COUNT(*) INTO v_count FROM public.coupon_redemptions;
    WHEN 'active_orders' THEN SELECT COUNT(*) INTO v_count FROM public.orders WHERE archived_at IS NULL;
    WHEN 'archived_orders' THEN SELECT COUNT(*) INTO v_count FROM public.orders WHERE archived_at IS NOT NULL;
    WHEN 'orders_all' THEN SELECT COUNT(*) INTO v_count FROM public.orders;
    WHEN 'order_logs' THEN SELECT COUNT(*) INTO v_count FROM public.order_logs;
    WHEN 'auction_history' THEN SELECT COUNT(*) INTO v_count FROM public.auction_events;
    WHEN 'auction_logs' THEN SELECT COUNT(*) INTO v_count FROM public.auction_logs;
    WHEN 'auction_winners' THEN SELECT COUNT(*) INTO v_count FROM public.auction_logs WHERE winner_user_id IS NOT NULL;
    WHEN 'badge_assignments' THEN SELECT COUNT(*) INTO v_count FROM public.user_badges;
    WHEN 'wishlist' THEN SELECT COUNT(*) INTO v_count FROM public.wishlist;
    WHEN 'carts' THEN SELECT COUNT(*) INTO v_count FROM public.cart_items;
    WHEN 'test_customers' THEN
      SELECT COUNT(*) INTO v_count FROM public.profiles p
       WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role IN ('admin','staff'));
    ELSE v_count := 0;
  END CASE;
  RETURN COALESCE(v_count, 0);
END; $function$;
