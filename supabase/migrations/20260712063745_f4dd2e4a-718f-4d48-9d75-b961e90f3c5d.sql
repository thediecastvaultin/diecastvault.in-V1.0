REVOKE ALL ON FUNCTION public.admin_grant_role_by_email(text, app_role, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_grant_role_by_email(text, app_role, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_role_by_email(text, app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_role_by_email(text, app_role, boolean) TO service_role;