
-- Trigger-only functions: no direct execute
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_low_stock() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies (runs as the query owner); direct calls not needed
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Admin RPCs: keep authenticated execute (they internally check has_role); revoke anon
REVOKE ALL ON FUNCTION public.admin_list_customers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, public.app_role, boolean) FROM PUBLIC, anon;
