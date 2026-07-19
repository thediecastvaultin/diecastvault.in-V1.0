
-- Wishlist: owned flag
ALTER TABLE public.wishlist
  ADD COLUMN IF NOT EXISTS owned BOOLEAN NOT NULL DEFAULT false;

-- Products: full-text search vector
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(series, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(rarity, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(color, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(cast(year as text), '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS products_search_vector_idx
  ON public.products USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS products_series_idx
  ON public.products (series);

CREATE INDEX IF NOT EXISTS products_rarity_idx
  ON public.products (rarity);
