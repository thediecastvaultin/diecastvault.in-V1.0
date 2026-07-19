
DELETE FROM public.reviews;

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS image_url text;

DROP POLICY IF EXISTS "Verified buyers create reviews" ON public.reviews;

CREATE POLICY "Buyers create reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = reviews.product_id
      AND o.user_id = auth.uid()
  )
);
