
-- 1. Payment status enum + column
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','paid','refunded','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'pending';

-- Backfill payment_status from existing order status heuristics
UPDATE public.orders SET payment_status = 'paid'
  WHERE payment_status = 'pending' AND status::text IN ('paid','packed','shipped','delivered');
UPDATE public.orders SET payment_status = 'failed'
  WHERE payment_status = 'pending' AND status::text = 'cancelled' AND payment_method::text <> 'cod';

-- 2. Monthly counter table
CREATE TABLE IF NOT EXISTS public.order_number_counters (
  period text PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.order_number_counters TO service_role;
ALTER TABLE public.order_number_counters ENABLE ROW LEVEL SECURITY;
-- No policies: only writable via SECURITY DEFINER function.

-- 3. Centralized generator
CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts timestamptz := now();
  v_period text := upper(to_char(v_ts AT TIME ZONE 'Asia/Kolkata','MON')) || to_char(v_ts AT TIME ZONE 'Asia/Kolkata','YY');
  v_seq int;
BEGIN
  INSERT INTO public.order_number_counters(period, last_seq)
    VALUES (v_period, 1)
  ON CONFLICT (period) DO UPDATE
    SET last_seq = public.order_number_counters.last_seq + 1,
        updated_at = now()
  RETURNING last_seq INTO v_seq;
  RETURN 'DV-' || v_period || '-' || lpad(v_seq::text, 4, '0');
END; $$;

REVOKE ALL ON FUNCTION public.next_order_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_order_number() TO authenticated, service_role;

-- 4. Trigger to auto-assign order_number on insert if missing or legacy format
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL
     OR NEW.order_number = ''
     OR NEW.order_number !~ '^DV-[A-Z]{3}[0-9]{2}-[0-9]{4}$' THEN
    NEW.order_number := public.next_order_number();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_assign_order_number ON public.orders;
CREATE TRIGGER trg_assign_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

-- 5. Drop the old random default; trigger owns assignment now
ALTER TABLE public.orders ALTER COLUMN order_number DROP DEFAULT;

-- 6. Backfill existing orders chronologically to the new format
DO $$
DECLARE
  r RECORD;
  v_period text;
  v_prev_period text := '';
  v_seq int := 0;
BEGIN
  -- Reset counters, then rebuild both order_number and counters
  TRUNCATE public.order_number_counters;
  FOR r IN
    SELECT id, created_at FROM public.orders ORDER BY created_at ASC, id ASC
  LOOP
    v_period := upper(to_char(r.created_at AT TIME ZONE 'Asia/Kolkata','MON')) || to_char(r.created_at AT TIME ZONE 'Asia/Kolkata','YY');
    IF v_period <> v_prev_period THEN
      v_seq := 0;
      v_prev_period := v_period;
    END IF;
    v_seq := v_seq + 1;
    UPDATE public.orders
       SET order_number = 'DV-' || v_period || '-' || lpad(v_seq::text, 4, '0')
     WHERE id = r.id;
  END LOOP;
  -- Sync counters to the max per period so the next generator call continues the sequence
  INSERT INTO public.order_number_counters(period, last_seq)
  SELECT split_part(order_number,'-',2) AS period,
         MAX((split_part(order_number,'-',3))::int) AS last_seq
    FROM public.orders
   WHERE order_number ~ '^DV-[A-Z]{3}[0-9]{2}-[0-9]{4}$'
   GROUP BY 1
  ON CONFLICT (period) DO UPDATE SET last_seq = EXCLUDED.last_seq, updated_at = now();
END $$;
