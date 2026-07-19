
-- Extend admin_count_scope for the new Prepare for Production scopes
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
    WHEN 'flash_announcements'  THEN SELECT COUNT(*) INTO v_count FROM public.announcements WHERE channel='flash';
    WHEN 'activity_events'      THEN SELECT COUNT(*) INTO v_count FROM public.activity_events;
    WHEN 'reviews'              THEN SELECT COUNT(*) INTO v_count FROM public.reviews;
    WHEN 'coupons'              THEN SELECT COUNT(*) INTO v_count FROM public.coupons;
    WHEN 'coupon_usage'         THEN SELECT COUNT(*) INTO v_count FROM public.coupon_redemptions;
    WHEN 'active_orders'        THEN SELECT COUNT(*) INTO v_count FROM public.orders WHERE archived_at IS NULL;
    WHEN 'archived_orders'      THEN SELECT COUNT(*) INTO v_count FROM public.orders WHERE archived_at IS NOT NULL;
    WHEN 'orders_all'           THEN SELECT COUNT(*) INTO v_count FROM public.orders;
    WHEN 'order_logs'           THEN SELECT COUNT(*) INTO v_count FROM public.order_logs;
    WHEN 'auction_history'      THEN SELECT COUNT(*) INTO v_count FROM public.auction_events;
    WHEN 'auction_logs'         THEN SELECT COUNT(*) INTO v_count FROM public.auction_logs;
    WHEN 'auction_winners'      THEN SELECT COUNT(*) INTO v_count FROM public.auction_logs WHERE winner_user_id IS NOT NULL;
    WHEN 'badge_assignments'    THEN SELECT COUNT(*) INTO v_count FROM public.user_badges;
    WHEN 'wishlist'             THEN SELECT COUNT(*) INTO v_count FROM public.wishlist;
    WHEN 'carts'                THEN SELECT COUNT(*) INTO v_count FROM public.cart_items;
    WHEN 'test_customers'       THEN
      SELECT COUNT(*) INTO v_count FROM public.profiles p
       WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r
                          WHERE r.user_id = p.id AND r.role IN ('admin','staff'));
    ELSE v_count := 0;
  END CASE;
  RETURN COALESCE(v_count, 0);
END; $function$;

-- One-shot production cleanup, transactional.
CREATE OR REPLACE FUNCTION public.admin_prepare_production(_include_flash boolean DEFAULT false, _include_notifications boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_t0 timestamptz := clock_timestamp();
  v_counts jsonb := '{}'::jsonb;
  v_total bigint := 0;
  v_n bigint;
  v_ids uuid[];
BEGIN
  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT email::text INTO v_actor_email FROM auth.users WHERE id = v_actor;

  -- notifications panel + delivered announcements (delivered history only if opted in)
  DELETE FROM public.admin_notifications;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('notifications', v_n); v_total := v_total + v_n;

  IF _include_notifications THEN
    DELETE FROM public.announcements WHERE channel = 'notification';
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('notification_history', v_n); v_total := v_total + v_n;
  END IF;

  IF _include_flash THEN
    DELETE FROM public.announcements WHERE channel = 'flash';
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('flash_announcements', v_n); v_total := v_total + v_n;
  END IF;

  -- carts / wishlist / reviews
  DELETE FROM public.cart_items; GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  DELETE FROM public.carts;      GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('carts', (SELECT (v_counts->>'carts')::bigint) IS NULL);
  -- simpler: just record cart_items count separately
  v_counts := v_counts - 'carts';
  SELECT COUNT(*) INTO v_n FROM public.cart_items; -- already zero; skip
  v_counts := v_counts || jsonb_build_object('shopping_carts', v_n);

  DELETE FROM public.wishlist;   GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('wishlist', v_n); v_total := v_total + v_n;
  DELETE FROM public.reviews;    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('reviews', v_n); v_total := v_total + v_n;

  -- orders + logs
  DELETE FROM public.order_logs; GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('order_logs', v_n); v_total := v_total + v_n;
  DELETE FROM public.orders;     GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('orders', v_n); v_total := v_total + v_n;

  -- auctions
  DELETE FROM public.auction_events; GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('auction_history', v_n); v_total := v_total + v_n;
  DELETE FROM public.auction_logs;   GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('auction_logs', v_n); v_total := v_total + v_n;
  DELETE FROM public.site_settings WHERE key = 'active_auction';

  -- coupon usage
  DELETE FROM public.coupon_redemptions; GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('coupon_usage', v_n); v_total := v_total + v_n;
  UPDATE public.coupons SET used_count = 0;

  -- badge assignments
  DELETE FROM public.user_badges; GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('badge_assignments', v_n); v_total := v_total + v_n;

  -- activity events
  DELETE FROM public.activity_events; GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('activity_events', v_n); v_total := v_total + v_n;

  -- test customers: profiles with no admin/staff role
  SELECT COALESCE(array_agg(p.id), '{}') INTO v_ids
    FROM public.profiles p
   WHERE NOT EXISTS (
     SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role IN ('admin','staff')
   );

  IF v_ids IS NOT NULL AND array_length(v_ids, 1) > 0 THEN
    DELETE FROM public.user_roles WHERE user_id = ANY(v_ids);
    DELETE FROM public.addresses  WHERE user_id = ANY(v_ids);
    DELETE FROM public.profiles   WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('test_customers', v_n);
    v_total := v_total + v_n;

    -- Auth users can only be removed by service role via the auth admin API,
    -- so we leave auth.users entries in place. The profile row is what the
    -- app reads, and it is now gone.
  ELSE
    v_counts := v_counts || jsonb_build_object('test_customers', 0);
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, metadata)
  VALUES (v_actor, v_actor_email, 'prepare_for_production', 'prepare_for_production',
          jsonb_build_object(
            'counts', v_counts,
            'total_rows', v_total,
            'duration_ms', (EXTRACT(EPOCH FROM (clock_timestamp() - v_t0)) * 1000)::int,
            'include_flash', _include_flash,
            'include_notifications', _include_notifications
          ));

  RETURN jsonb_build_object(
    'total_rows', v_total,
    'duration_ms', (EXTRACT(EPOCH FROM (clock_timestamp() - v_t0)) * 1000)::int,
    'counts', v_counts
  );
END; $function$;

REVOKE ALL ON FUNCTION public.admin_prepare_production(boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_prepare_production(boolean, boolean) TO authenticated;
