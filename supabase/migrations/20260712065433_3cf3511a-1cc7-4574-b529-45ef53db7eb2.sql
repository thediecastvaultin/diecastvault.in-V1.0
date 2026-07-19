DROP POLICY IF EXISTS "Reviews readable by all" ON public.reviews;

DROP POLICY IF EXISTS "Staff can moderate reviews" ON public.reviews;
CREATE POLICY "Staff can moderate reviews"
  ON public.reviews FOR UPDATE
  USING (public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'staff'));

DROP POLICY IF EXISTS "Staff can delete reviews" ON public.reviews;
CREATE POLICY "Staff can delete reviews"
  ON public.reviews FOR DELETE
  USING (public.has_role(auth.uid(), 'staff'));