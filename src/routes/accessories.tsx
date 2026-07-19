import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { ProductCard, type ProductCardData } from "@/components/site/ProductCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PackageOpen } from "lucide-react";

export const Route = createFileRoute("/accessories")({
  head: () => ({
    meta: [
      { title: "Accessories — The Diecast Vault" },
      { name: "description", content: "Card protectors, display shelves, and cleaning kits for your diecast collection." },
      { property: "og:title", content: "Accessories — The Diecast Vault" },
      { property: "og:description", content: "Protect and display your collection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccessoriesPage,
});

type Sort = "newest" | "price-asc" | "price-desc" | "name";

function AccessoriesPage() {
  const [sort, setSort] = useState<Sort>("newest");

  const { data: items, isLoading } = useQuery({
    queryKey: ["accessories-products"],
    queryFn: async () => {
      const { data: cat } = await supabase
        .from("product_categories")
        .select("id")
        .eq("slug", "accessories")
        .maybeSingle();
      if (!cat) return [] as ProductCardData[];
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, series, year, price_cents, stock_quantity, low_stock_threshold, rarity, image_urls, coming_soon")
        .eq("status", "published")
        .eq("category_id", cat.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductCardData[];
    },
  });

  const sorted = useMemo(() => {
    const arr = [...(items ?? [])];
    switch (sort) {
      case "price-asc": return arr.sort((a, b) => a.price_cents - b.price_cents);
      case "price-desc": return arr.sort((a, b) => b.price_cents - a.price_cents);
      case "name": return arr.sort((a, b) => a.name.localeCompare(b.name));
      default: return arr;
    }
  }, [items, sort]);

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-12 md:py-16">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ Accessories</div>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-tight md:text-5xl">
          Keep them <span className="font-display italic font-normal normal-case text-muted-foreground">mint</span>
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Protectors, shelves, and care kits for the vault.
        </p>

        {isLoading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-card/60" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border/60 bg-card/30 p-16 text-center">
            <PackageOpen className="h-10 w-10 text-muted-foreground/60" />
            <div className="mt-4 font-display text-2xl italic text-muted-foreground">
              No accessories yet — check back soon.
            </div>
            <Button asChild variant="outline" className="mt-6 rounded-full">
              <Link to="/shop">Browse the vault</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-8 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 px-4 py-3 backdrop-blur">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {sorted.length} {sorted.length === 1 ? "item" : "items"}
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger className="h-9 w-[160px] rounded-full border-border/60 bg-background/60 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-asc">Price: Low → High</SelectItem>
                  <SelectItem value="price-desc">Price: High → Low</SelectItem>
                  <SelectItem value="name">Name A → Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {sorted.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </>
        )}

        <div className="mt-10">
          <Button asChild variant="ghost"><Link to="/shop">← Back to the vault</Link></Button>
        </div>
      </section>
    </SiteShell>
  );
}
