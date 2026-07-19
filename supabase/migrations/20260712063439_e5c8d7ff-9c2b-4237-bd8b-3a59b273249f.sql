CREATE OR REPLACE FUNCTION public.admin_grant_role_by_email(_email text, _role app_role, _grant boolean)
 RETURNS TABLE(user_id uuid, email text, granted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _target uuid;
  _confirmed timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT u.id, u.email_confirmed_at
    INTO _target, _confirmed
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(_email))
  LIMIT 1;

  IF _target IS NULL THEN
    RAISE EXCEPTION 'no user found with email %', _email;
  END IF;

  IF _confirmed IS NULL THEN
    RAISE EXCEPTION 'user % has not confirmed their email yet', _email;
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles ur WHERE ur.user_id = _target AND ur.role = _role;
  END IF;

  RETURN QUERY SELECT _target, lower(trim(_email)), _grant;
END;
$function$;