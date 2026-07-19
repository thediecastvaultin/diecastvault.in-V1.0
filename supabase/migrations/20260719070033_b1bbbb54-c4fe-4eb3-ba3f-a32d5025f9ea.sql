-- Fix Final Reset RPC: delete coupon_redemptions BEFORE orders (FK NO ACTION),
-- rename audit action to 'final_reset', keep backward-compat.
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
    RAISE EXCEPTION 'Only admins can run Final Reset';
  END IF;

  SELECT email::text INTO v_actor_email FROM auth.users WHERE id = v_actor;

  -- Notifications panel
  DELETE FROM public.admin_notifications;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('notifications', v_n); v_total := v_total + v_n;

  IF _include_notifications THEN
    DELETE FROM public.announcements WHERE channel = 'notification';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('notification_history', v_n); v_total := v_total + v_n;
  END IF;

  IF _include_flash THEN
    DELETE FROM public.announcements WHERE channel = 'flash';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('flash_announcements', v_n); v_total := v_total + v_n;
  END IF;

  -- Carts / wishlist / reviews
  DELETE FROM public.cart_items;
  DELETE FROM public.carts;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('shopping_carts', v_n); v_total := v_total + v_n;

  DELETE FROM public.wishlist;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('wishlist', v_n); v_total := v_total + v_n;

  DELETE FROM public.reviews;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('reviews', v_n); v_total := v_total + v_n;

  -- Coupon usage MUST be deleted before orders (FK NO ACTION on order_id)
  DELETE FROM public.coupon_redemptions;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('coupon_usage', v_n); v_total := v_total + v_n;
  UPDATE public.coupons SET used_count = 0;

  -- Order logs
  DELETE FROM public.order_logs;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('order_logs', v_n); v_total := v_total + v_n;

  -- Orders (order_items cascades)
  DELETE FROM public.orders;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('orders', v_n); v_total := v_total + v_n;

  -- Auctions
  DELETE FROM public.auction_events;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('auction_history', v_n); v_total := v_total + v_n;

  DELETE FROM public.auction_logs;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('auction_logs', v_n); v_total := v_total + v_n;

  DELETE FROM public.site_settings WHERE key = 'active_auction';

  -- Badge assignments
  DELETE FROM public.user_badges;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('badge_assignments', v_n); v_total := v_total + v_n;

  -- Activity events
  DELETE FROM public.activity_events;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('activity_events', v_n); v_total := v_total + v_n;

  -- Test customer profiles (no staff/admin role) — auth.users stays intact
  SELECT COALESCE(array_agg(p.id), '{}'::uuid[]) INTO v_ids
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
  ELSE
    v_counts := v_counts || jsonb_build_object('test_customers', 0);
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, metadata)
  VALUES (v_actor, v_actor_email, 'final_reset', 'final_reset',
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