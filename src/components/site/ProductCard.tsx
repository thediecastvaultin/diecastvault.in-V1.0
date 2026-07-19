import { Link } from "@tanstack/react-router";
import { formatPrice } from "@/lib/format";
import { Heart, Minus, Plus, ShoppingCart } from "lucide-react";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCart } from "@/hooks/use-cart";
import { ensurePurchaseAllowed } from "@/lib/purchase-limit";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { toast } from "sonner";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  series: string;
  year: number | null;
  price_cents: number;
  stock_quantity: number;
  low_stock_threshold: number;
  rarity: string | null;
  image_urls: string[];
  coming_soon?: boolean;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = product.image_urls[0];
  const out = product.stock_quantity === 0;
  const low = !out && product.stock_quantity <= product.low_stock_threshold;
  const wl = useWishlist();
  const saved = wl.isSaved(product.id);
  const cart = useCart();
  const inCart = cart.items.find((i) => i.productId === product.id);
  const qty = inCart?.quantity ?? 0;
  const { comingSoon: globalComingSoon } = useSiteSettings();
  const comingSoon = globalComingSoon || product.coming_soon === true;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const addToCart = async (e: React.MouseEvent) => {
    stop(e);
    if (out) return;
    const nextQty = (inCart?.quantity ?? 0) + 1;
    const ok = await ensurePurchaseAllowed(product.id, nextQty, product.name);
    if (!ok) return;
    cart.add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      series: product.series,
      image: product.image_urls[0] ?? null,
      unitPriceCents: product.price_cents,
      stock: product.stock_quantity,
    });
    toast.success(`${product.name} added to cart`);
  };

  return (
    <Link
      to="/shop/$slug"
      params={{ slug: product.slug }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[var(--shadow-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary/40">
        {image ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="inline-flex items-center rounded-full border border-border/60 bg-background/80 px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/85 backdrop-blur-md">
            {product.series}
          </span>
          {low && !out ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-400 backdrop-blur-md">
              <span className="h-1 w-1 rounded-full bg-amber-400" /> Low
            </span>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={saved ? "Remove from collection" : "Save to collection"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!wl.signedIn) return toast.error("Sign in to save cars");
            saved ? wl.remove(product.id) : wl.add(product.id);
          }}
          className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:border-red-500/50 hover:text-red-500"
        >
          <Heart className={`h-4 w-4 transition-colors ${saved ? "fill-red-500 text-red-500" : ""}`} />
        </button>

        {out ? (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-background/70 via-background/10 to-transparent p-3">
            <span className="rounded-full border border-primary/50 bg-background/90 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-primary backdrop-blur">
              Sold out
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-[15px] font-bold leading-tight tracking-tight">{product.name}</h3>
          {comingSoon ? (
            <div className="shrink-0 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Soon
            </div>
          ) : (
            <div className="shrink-0 whitespace-nowrap font-mono text-sm font-bold tracking-tight text-primary">
              {formatPrice(product.price_cents)}
            </div>
          )}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {product.year ?? "—"} · {product.series}
        </div>

        {comingSoon ? (
          <div className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border/60 bg-muted/40 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
            Coming soon
          </div>
        ) : out ? (
          <div className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border/60 bg-muted/30 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
            Sold out
          </div>
        ) : qty === 0 ? (
          <button
            type="button"
            onClick={addToCart}
            className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-primary/50 bg-primary/5 text-xs font-bold uppercase tracking-[0.16em] text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-[var(--shadow-glow)]"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Add to cart
          </button>
        ) : (
          <div className="mt-auto flex h-10 items-center justify-between gap-2 rounded-full border border-primary/50 bg-primary/10 pl-1 pr-1">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={(e) => {
                stop(e);
                if (qty <= 1) cart.remove(product.id);
                else cart.setQty(product.id, qty - 1);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {qty} in cart
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={qty >= product.stock_quantity}
              onClick={async (e) => {
                stop(e);
                const ok = await ensurePurchaseAllowed(product.id, qty + 1, product.name);
                if (!ok) return;
                cart.setQty(product.id, qty + 1);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </Link>
  );
}
