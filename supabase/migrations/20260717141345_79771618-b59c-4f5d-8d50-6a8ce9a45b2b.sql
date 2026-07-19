
-- Announcements table (banner + history)
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  pinned BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can read active, in-window announcements
CREATE POLICY "Public read active announcements"
ON public.announcements FOR SELECT
USING (
  active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (expires_at IS NULL OR expires_at > now())
);

-- Staff/admin full manage + read all
CREATE POLICY "Staff manage announcements"
ON public.announcements FOR ALL
TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE TRIGGER announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX announcements_active_idx ON public.announcements (active, pinned DESC, created_at DESC);

-- When a new announcement is inserted (active), fan out to admin_notifications so staff see it in history/bell
CREATE OR REPLACE FUNCTION public.on_announcement_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active = true THEN
    INSERT INTO public.admin_notifications (kind, title, body, link)
    VALUES ('announcement', NEW.title, NEW.body, NEW.link);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER announcements_notify
AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.on_announcement_published();
