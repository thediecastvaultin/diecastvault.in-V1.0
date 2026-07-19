
-- Dedupe: keep most recently updated default per user, unset the rest
WITH ranked AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM public.addresses
  WHERE is_default = true
)
UPDATE public.addresses a
   SET is_default = false, updated_at = now()
  FROM ranked r
 WHERE a.id = r.id AND r.rn > 1;

-- Prevent this from ever happening again
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user
  ON public.addresses (user_id) WHERE is_default = true;
