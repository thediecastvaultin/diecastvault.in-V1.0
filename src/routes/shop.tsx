import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { ProductCard, type ProductCardData } from "@/components/site/ProductCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { Search } from "lucide-react";

const searchSchema = z.object({
  series: z.string().optional(),
  category: z.string().optional(),
  rarity: z.string().optional(),
  color: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "name"]).optional(),
  in_stock: z.coerce.boolean().optional(),
  price_max: z.coerce.number().optional(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop Hot Wheels — The Diecast Vault" },
      { name: "description", content: "Browse the full catalog: Mainline, Premium, Team Transport, Redlines and Treasure Hunt Hot Wheels — priced in INR." },
      { property: "og:title", content: "Shop Hot Wheels — The Diecast Vault" },
      { property: "og:description", content: "Filter by series, year, price and color. In-stock only." },
    ],
  }),
  component: ShopPage,
});

const SERIES = ["Mainline", "Premium", "Team Transport", "Red Line Club", "Treasure Hunts"];

const PRICE_MAX_BOUND = 15000;

function ShopPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { hideOutOfStock } = useSiteSettings();

  const q = search.q ?? "";
  const series = search.series ?? "";
  const category = search.category ?? "";
  const color = search.color ?? "";
  const sort = search.sort ?? "newest";
  const inStockOnly = !!search.in_stock;
  const priceMax = search.price_max ?? PRICE_MAX_BOUND;

  function patch(next: Partial<typeof search>) {
    const merged: Record<string, unknown> = { ...search, ...next };
    Object.keys(merged).forEach((k) => {
      const v = merged[k];
      if (v === "" || v === undefined || v === null || v === false) delete merged[k];
    });
    navigate({
      to: ".",
      search: merged as never,
    });
  }

  const { data: allProducts, isLoading } = useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, series, year, price_cents, stock_quantity, low_stock_threshold, rarity, color, image_urls, created_at, category_id, coming_soon")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allCategories } = useQuery({
    queryKey: ["product_categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_categories")
        .select("id, slug, name, sort_order")
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
  });

  const categories = useMemo(
    () => (allCategories ?? []).filter((c) => c.slug !== "accessories"),
    [allCategories],
  );
  const accessoriesCatId = useMemo(
    () => (allCategories ?? []).find((c) => c.slug === "accessories")?.id ?? null,
    [allCategories],
  );

  const colors = useMemo(() => {
    const set = new Set<string>();
    (allProducts ?? []).forEach((p) => p.color && set.add(p.color));
    return [...set].sort();
  }, [allProducts]);

  const filtered = useMemo(() => {
    if (!allProducts) return [];
    let list = accessoriesCatId
      ? allProducts.filter((p) => p.category_id !== accessoriesCatId)
      : [...allProducts];
    if (series) list = list.filter((p) => p.series === series);
    if (category) {
      const cat = categories?.find((c) => c.slug === category);
      if (cat) list = list.filter((p) => p.category_id === cat.id);
    }
    if (color) list = list.filter((p) => (p.color ?? "") === color);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.series.toLowerCase().includes(needle),
      );
    }
    list = list.filter((p) => p.price_cents / 100 <= priceMax);
    if (inStockOnly || hideOutOfStock) list = list.filter((p) => p.stock_quantity > 0);
    switch (sort) {
      case "price-asc": list.sort((a, b) => a.price_cents - b.price_cents); break;
      case "price-desc": list.sort((a, b) => b.price_cents - a.price_cents); break;
      case "name": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return list as ProductCardData[];
  }, [allProducts, categories, accessoriesCatId, series, category, color, q, priceMax, inStockOnly, hideOutOfStock, sort]);

  function clearAll() {
    navigate({ search: {} as never });
  }

  const activeFilters =
    (series ? 1 : 0) + (category ? 1 : 0) + (color ? 1 : 0) + (inStockOnly ? 1 : 0) +
    (priceMax < PRICE_MAX_BOUND ? 1 : 0);

  return (
    <SiteShell>
      {/* Editorial banner */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ Catalog — Vol. 07</div>
          <h1 className="mt-3 text-5xl font-black uppercase tracking-tight md:text-7xl">
            Shop the <span className="font-display italic font-normal normal-case text-muted-foreground">vault</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground">
            {allProducts?.length ?? 0} castings across every series. Filter, sort, snag.
          </p>
          {categories && categories.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => patch({ category: "" })}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  !category
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {categories.map((c) => {
                const active = category === c.slug;
                return (
                  <button
                    key={c.id}
                    onClick={() => patch({ category: active ? "" : c.slug })}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside className="space-y-8 rounded-2xl border border-border/70 bg-card/40 p-6 md:sticky md:top-20 md:h-fit">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Filters</div>
            {activeFilters > 0 ? (
              <button onClick={clearAll} className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground underline underline-offset-4">
                Reset ({activeFilters})
              </button>
            ) : null}
          </div>

          <div>
            <Label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Car name…"
                value={q}
                onChange={(e) => patch({ q: e.target.value })}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label className="mb-3 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Series</Label>
            <div className="flex flex-wrap gap-2">
              {SERIES.map((s) => {
                const active = series === s;
                return (
                  <button
                    key={s}
                    onClick={() => patch({ series: active ? "" : s })}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {colors.length > 0 ? (
            <div>
              <Label className="mb-3 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Color</Label>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => {
                  const active = color === c;
                  return (
                    <button
                      key={c}
                      onClick={() => patch({ color: active ? "" : c })}
                      className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{ touchAction: "none" }}
          >
            <Label className="mb-3 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Max price · ₹{priceMax.toLocaleString("en-IN")}
            </Label>
            <Slider
              value={[priceMax]}
              min={200}
              max={PRICE_MAX_BOUND}
              step={100}
              onValueChange={([v]) =>
                patch({ price_max: v >= PRICE_MAX_BOUND ? undefined : v })
              }
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={inStockOnly}
              onCheckedChange={(v) => patch({ in_stock: !!v })}
            />
            In stock only
          </label>
        </aside>

        {/* Grid */}
        <div>
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 px-4 py-3 sm:px-5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xl font-black tabular-nums text-foreground">{filtered.length}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                result{filtered.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">Sort</span>
              <Select value={sort} onValueChange={(v) => patch({ sort: v as typeof sort })}>
                <SelectTrigger className="h-9 w-[180px] rounded-full border-border/70 bg-background/60 text-xs sm:w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Just dropped</SelectItem>
                  <SelectItem value="price-asc">Price · Low to High</SelectItem>
                  <SelectItem value="price-desc">Price · High to Low</SelectItem>
                  <SelectItem value="name">Name · A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
                  <div className="aspect-square animate-pulse bg-muted/40" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted/50" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-muted/40" />
                    <div className="mt-3 h-10 w-full animate-pulse rounded-full bg-muted/40" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-12 text-center sm:p-16">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-border/60 bg-background/60">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-4 font-display text-2xl italic text-muted-foreground">Nothing matches those filters.</div>
              <p className="mt-1 text-xs text-muted-foreground">Try clearing a filter or broadening the price range.</p>
              <Button variant="outline" onClick={clearAll} className="mt-6 rounded-full">Reset filters</Button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
