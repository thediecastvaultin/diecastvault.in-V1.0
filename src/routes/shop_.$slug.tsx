import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { ProductCard, type ProductCardData } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCart } from "@/hooks/use-cart";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { ReviewsSection } from "@/components/site/ReviewsSection";
import { toast } from "sonner";
import { ensurePurchaseAllowed } from "@/lib/purchase-limit";
import { Heart, Check, ArrowLeft, ShieldCheck, Truck, Package, Minus, Plus, Trash2, Sparkles, LayoutGrid } from "lucide-react";
import { ShareMenu } from "@/components/site/ShareMenu";

export const Route = createFileRoute("/shop_/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return { product: data };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Car not found — The Diecast Vault" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.product;
    const title = p.meta_title || `${p.name} · ${p.series} — The Diecast Vault`;
    const desc = p.meta_description || p.description || `${p.name} (${p.year ?? "—"}) — ${p.series}. ${formatPrice(p.price_cents)}.`;
    const img = p.og_image_url || p.image_urls?.[0];
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(img ? [
          { property: "og:image", content: img },
          { name: "twitter:image", content: img },
        ] : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <SiteShell>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-4xl">Something broke</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button asChild className="mt-6"><Link to="/shop">Back to shop</Link></Button>
      </div>
    </SiteShell>
  ),
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-5xl">Not in the vault</h1>
        <p className="mt-2 text-sm text-muted-foreground">This casting couldn't be found. It may have sold out.</p>
        <Button asChild className="mt-6"><Link to="/shop">Browse the vault</Link></Button>
      </div>
    </SiteShell>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product: p } = Route.useLoaderData();
  const router = useRouter();
  const [imgIdx, setImgIdx] = useState(0);
  const wl = useWishlist();
  const cart = useCart();
  const { comingSoon: globalComingSoon } = useSiteSettings();
  const comingSoon = globalComingSoon || p.coming_soon === true;
  const saved = wl.isSaved(p.id);
  const owned = wl.isOwned(p.id);
  const out = p.stock_quantity === 0;
  const low = !out && p.stock_quantity <= p.low_stock_threshold;
  const inCart = cart.items.find((i) => i.productId === p.id);

  const { data: related } = useQuery({
    queryKey: ["related", p.series, p.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, slug, name, series, year, price_cents, stock_quantity, low_stock_threshold, rarity, image_urls, coming_soon")
        .eq("series", p.series)
        .neq("id", p.id)
        .limit(4);
      return (data ?? []) as ProductCardData[];
    },
  });

  const image = p.image_urls?.[imgIdx] ?? p.image_urls?.[0];


  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <button
          onClick={() => router.history.back()}
          className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
          {/* Gallery */}
          <div>
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card">
              {image ? (
                <img src={image} alt={p.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="aspect-square w-full bg-muted" />
              )}
              {out ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                  <span className="rounded-full border border-primary/60 bg-background/90 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.22em] text-primary">
                    Sold out
                  </span>
                </div>
              ) : null}
            </div>
            {p.image_urls && p.image_urls.length > 1 ? (
              <div className="mt-4 grid grid-cols-5 gap-2">
                {p.image_urls.map((u: string, i: number) => (
                  <button
                    key={u + i}
                    onClick={() => setImgIdx(i)}
                    className={`aspect-square overflow-hidden rounded-md border ${
                      i === imgIdx ? "border-primary" : "border-border/60"
                    }`}
                  >
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Info */}
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <Link to="/shop" search={{ series: p.series } as never} className="hover:text-foreground">
                {p.series}
              </Link>
              <span>·</span>
              <span>{p.year ?? "—"}</span>
              {p.color ? <><span>·</span><span>{p.color}</span></> : null}
            </div>

            <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight md:text-5xl">
              {p.name}
            </h1>

            <div className="mt-6 flex items-baseline gap-4">
              {comingSoon ? (
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Price revealed at launch</div>
              ) : (
                <div className="font-mono text-3xl font-bold">{formatPrice(p.price_cents)}</div>
              )}
            </div>

            <div className="mt-2">
              {comingSoon ? (
                <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Coming soon</div>
              ) : out ? (
                <div className="font-mono text-xs uppercase tracking-[0.22em] text-destructive">Sold out</div>
              ) : low ? (
                <div className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
                  Only {p.stock_quantity} left in the vault
                </div>
              ) : (
                <div className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  In stock · ships in 24h
                </div>
              )}
            </div>

            {p.description ? (
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {p.description}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              {comingSoon ? (
                <Button size="lg" disabled className="h-12 flex-1 rounded-full sm:flex-none sm:min-w-48">
                  Coming soon
                </Button>
              ) : inCart ? (
                <>
                <div className="flex h-12 flex-1 items-center justify-between gap-2 rounded-full border border-border/70 bg-card/60 pl-2 pr-2 sm:flex-none sm:min-w-48">
                  <button
                    onClick={() =>
                      inCart.quantity <= 1
                        ? cart.remove(p.id)
                        : cart.setQty(p.id, inCart.quantity - 1)
                    }
                    aria-label={inCart.quantity <= 1 ? "Remove from cart" : "Decrease quantity"}
                    className="grid h-9 w-9 place-items-center rounded-full text-foreground hover:bg-muted"
                  >
                    {inCart.quantity <= 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                  </button>
                  <div className="flex flex-col items-center leading-tight">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">In cart</span>
                    <span className="font-mono text-base font-bold">{inCart.quantity}</span>
                  </div>
                  <button
                    onClick={async () => {
                      const ok = await ensurePurchaseAllowed(p.id, inCart.quantity + 1, p.name);
                      if (!ok) return;
                      cart.setQty(p.id, inCart.quantity + 1);
                    }}
                    disabled={inCart.quantity >= p.stock_quantity}
                    aria-label="Increase quantity"
                    className="grid h-9 w-9 place-items-center rounded-full text-foreground hover:bg-muted disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-12 rounded-full px-4 text-xs font-mono uppercase tracking-[0.2em]">
                  <Link to="/checkout">Go to checkout →</Link>
                </Button>
                </>
              ) : (
                <Button
                  size="lg"
                  disabled={out}
                  onClick={async () => {
                    const ok = await ensurePurchaseAllowed(p.id, 1, p.name);
                    if (!ok) return;
                    cart.add({
                      productId: p.id,
                      slug: p.slug,
                      name: p.name,
                      series: p.series,
                      image: p.image_urls?.[0] ?? null,
                      unitPriceCents: p.price_cents,
                      stock: p.stock_quantity,
                    });
                    toast.success("Added to cart");
                  }}
                  className="h-12 flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow)] sm:flex-none sm:min-w-48"
                >
                  {out ? "Sold out" : "Add to cart"}
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="h-12 rounded-full"
                onClick={() => {
                  if (!wl.signedIn) return toast.error("Sign in to save cars");
                  saved ? wl.remove(p.id) : wl.add(p.id);
                }}
              >
                <Heart className={`mr-2 h-4 w-4 text-red-500 ${saved ? "fill-red-500" : ""}`} />
                {saved ? "Saved" : "Save"}
              </Button>
              {saved ? (
                <Button
                  variant={owned ? "default" : "outline"}
                  size="lg"
                  className="h-12 rounded-full"
                  onClick={() => wl.toggleOwned({ productId: p.id, owned: !owned })}
                >
                  <Check className={`mr-2 h-4 w-4 ${owned ? "" : "opacity-50"}`} />
                  {owned ? "Owned" : "Mark owned"}
                </Button>
              ) : null}
              <ShareMenu title={p.name} />
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full">
                <a href="#reviews">Reviews ↓</a>
              </Button>
            </div>

            <ul className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-border/70 bg-card/40 px-5 py-4">
              {(
                [
                  [Truck, "Ships in 24h across India"],
                  [Package, "Mint carded"],
                  [ShieldCheck, "Authenticity guaranteed"],
                ] as const
              ).flatMap(([Icon, label], i, arr) => [
                <li key={label} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </li>,
                ...(i < arr.length - 1
                  ? [<li key={`${label}-sep`} aria-hidden className="text-muted-foreground/50">·</li>]
                  : []),
              ])}
            </ul>

            {/* Keep it mint — editorial heading */}
            <div className="mt-10">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ Accessories</div>
              <div className="mt-2 flex items-end justify-between gap-4">
                <h2 className="text-3xl font-black uppercase leading-[0.95] tracking-tight md:text-4xl">
                  Keep it <span className="font-display italic font-normal normal-case text-muted-foreground">mint</span>
                </h2>
                <Link to="/accessories" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-primary">
                  See all →
                </Link>
              </div>
              <div className="mt-4" />
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: "Protector", price: 24900, Icon: ShieldCheck },
                  { name: "Shelf", price: 89900, Icon: LayoutGrid },
                  { name: "Detailing", price: 14900, Icon: Sparkles },
                ].map(({ name, price, Icon }) => (
                  <Link
                    key={name}
                    to="/accessories"
                    className="group flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/40 p-4 text-center transition-colors hover:border-primary/60 hover:bg-card/70"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-background/60 text-muted-foreground transition-colors group-hover:text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="mt-2 text-xs font-semibold">{name}</div>
                    <div className="mt-1 font-mono text-[11px] font-bold text-primary">{formatPrice(price)}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {related && related.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ From the same lane</div>
              <h2 className="mt-2 text-3xl font-black uppercase tracking-tight md:text-4xl">
                More <span className="font-display italic font-normal normal-case text-muted-foreground">{p.series}</span>
              </h2>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </section>
      ) : null}

      <ReviewsSection productId={p.id} />
    </SiteShell>
  );
}
