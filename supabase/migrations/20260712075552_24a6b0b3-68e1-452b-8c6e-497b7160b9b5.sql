
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON public.product_categories FOR SELECT USING (true);

CREATE POLICY "Staff and admins can insert categories"
  ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff and admins can update categories"
  ON public.product_categories FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins can delete categories"
  ON public.product_categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER product_categories_set_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.product_categories (slug, name, sort_order)
VALUES ('hot-wheels', 'Hot Wheels', 10),
       ('accessories', 'Accessories', 20);

ALTER TABLE public.products
  ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN coming_soon boolean NOT NULL DEFAULT false;

UPDATE public.products
SET category_id = (SELECT id FROM public.product_categories WHERE slug = 'hot-wheels')
WHERE category_id IS NULL;

CREATE INDEX products_category_id_idx ON public.products(category_id);
