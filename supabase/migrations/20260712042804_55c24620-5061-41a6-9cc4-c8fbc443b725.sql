
-- Remove the permissive INSERT policy; the trigger runs SECURITY DEFINER and bypasses RLS,
-- so no user-facing INSERT policy is needed.
DROP POLICY IF EXISTS "System inserts notifications" ON public.admin_notifications;
