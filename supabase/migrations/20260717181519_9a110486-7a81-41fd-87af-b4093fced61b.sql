
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, phone) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END; $$;

DROP FUNCTION IF EXISTS public.admin_list_customers();

CREATE OR REPLACE FUNCTION public.admin_list_customers()
RETURNS TABLE(user_id uuid, email text, display_name text, phone text, order_count bigint, total_spent_cents bigint, last_order_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, u.email::text, p.display_name, p.phone,
         COUNT(o.id), COALESCE(SUM(o.total_cents), 0), MAX(o.created_at)
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.orders o ON o.user_id = p.id
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  GROUP BY p.id, u.email, p.display_name, p.phone
  ORDER BY COALESCE(SUM(o.total_cents),0) DESC;
$$;
