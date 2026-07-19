
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'flash',
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS push_sent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.announcements ALTER COLUMN title DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.announcements ADD CONSTRAINT announcements_channel_check
    CHECK (channel IN ('flash','notification'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.announcements ADD CONSTRAINT announcements_title_or_body
    CHECK (COALESCE(NULLIF(trim(title), ''), NULLIF(trim(body), '')) IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.notify_announcement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active AND NEW.channel = 'notification' AND NEW.push_sent THEN
    INSERT INTO public.admin_notifications (kind, title, body, link, starts_at, expires_at, display_order)
    VALUES (COALESCE(NEW.kind,'default'), COALESCE(NEW.title,'Announcement'), NEW.body, NEW.link, NEW.starts_at, NEW.expires_at, NEW.display_order);
  END IF;
  RETURN NEW;
END; $$;
