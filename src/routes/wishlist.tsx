import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { ProductCard, type ProductCardData } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWishlist } from "@/hooks/use-wishlist";
import { toast } from "sonner";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "My Collection — The Diecast Vault" },
      { name: "description", content: "Your saved Hot Wheels — wanted and owned." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { user, loading } = useAuth();
  const wl = useWishlist();
  const [tab, setTab] = useState<"wanted" | "owned">("wanted");

  const { data: items } = useQuery({
    enabled: !!user,
    queryKey: ["wishlist-detailed", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist")
        .select("owned, product:products(id, slug, name, series, year, price_cents, stock_quantity, low_stock_threshold, rarity, image_urls)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.product)
        .map((r) => ({ ...(r.product as unknown as ProductCardData), owned: r.owned }));
    },
  });

  const wanted = useMemo(() => (items ?? []).filter((i) => !i.owned), [items]);
  const owned = useMemo(() => (items ?? []).filter((i) => i.owned), [items]);

  if (loading) return <SiteShell><div className="p-16 text-center text-muted-foreground">Loading…</div></SiteShell>;

  if (!user) {
    return (
      <SiteShell>
        <section className="mx-auto max-w-md px-4 py-24 text-center">
          <Heart className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="font-display text-5xl italic">Start your collection</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in to bookmark cars you want and track what you already own.
          </p>
          <Button asChild className="mt-6 rounded-full bg-primary px-6 hover:bg-primary/90">
            <Link to="/auth">Sign in</Link>
          </Button>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ Your vault</div>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-tight md:text-6xl">
          My <span className="font-display italic font-normal normal-case text-muted-foreground">collection</span>
        </h1>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "wanted" | "owned")} className="mt-10">
          <TabsList className="h-auto rounded-full border border-border/70 bg-card/50 p-1.5">
            <TabsTrigger value="wanted" className="rounded-full px-7 py-2.5 text-sm font-bold uppercase tracking-wider">
              Wanted · {wanted.length}
            </TabsTrigger>
            <TabsTrigger value="owned" className="rounded-full px-7 py-2.5 text-sm font-bold uppercase tracking-wider">
              Owned · {owned.length}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wanted" className="mt-8">
            {wanted.length === 0 ? (
              <EmptyState title="Nothing on the wishlist yet" cta />
            ) : (
              <Grid items={wanted} showMarkOwned onMarkOwned={(id) => {
                wl.toggleOwned({ productId: id, owned: true });
                toast.success("Moved to Owned");
              }} />
            )}
          </TabsContent>
          <TabsContent value="owned" className="mt-8">
            {owned.length === 0 ? (
              <EmptyState title="No owned cars marked yet" />
            ) : (
              <Grid items={owned} onMarkOwned={(id) => {
                wl.toggleOwned({ productId: id, owned: false });
                toast.success("Moved back to Wanted");
              }} unmarkOwned />
            )}
          </TabsContent>
        </Tabs>
      </section>
    </SiteShell>
  );
}

function Grid({
  items,
  showMarkOwned,
  unmarkOwned,
  onMarkOwned,
}: {
  items: ProductCardData[];
  showMarkOwned?: boolean;
  unmarkOwned?: boolean;
  onMarkOwned?: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((p) => (
        <div key={p.id} className="flex flex-col gap-2">
          <ProductCard product={p} />
          {(showMarkOwned || unmarkOwned) && onMarkOwned ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-[11px]"
              onClick={() => onMarkOwned(p.id)}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {unmarkOwned ? "Move to Wanted" : "Mark as owned"}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, cta }: { title: string; cta?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 p-16 text-center">
      <div className="font-display text-3xl italic text-muted-foreground">{title}</div>
      {cta ? (
        <Button asChild className="mt-6 rounded-full">
          <Link to="/shop">Browse the vault</Link>
        </Button>
      ) : null}
    </div>
  );
}
