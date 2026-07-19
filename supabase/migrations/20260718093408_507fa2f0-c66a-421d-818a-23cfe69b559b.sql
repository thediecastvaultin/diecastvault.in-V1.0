DROP TRIGGER IF EXISTS announcements_notify ON public.announcements;
DROP FUNCTION IF EXISTS public.on_announcement_published();

CREATE OR REPLACE FUNCTION public.notify_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.active AND NEW.channel = 'notification' AND NEW.push_sent THEN
    INSERT INTO public.admin_notifications (kind, title, body, link, starts_at, expires_at, display_order)
    VALUES (
      COALESCE(NULLIF(NEW.kind, ''), 'default'),
      COALESCE(NULLIF(NEW.title, ''), 'Notification'),
      NEW.body,
      NEW.link,
      NEW.starts_at,
      NEW.expires_at,
      NEW.display_order
    );
  END IF;
  RETURN NEW;
END;
$function$;