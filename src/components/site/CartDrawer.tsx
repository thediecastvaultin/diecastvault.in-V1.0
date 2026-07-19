import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";
import { ensurePurchaseAllowed } from "@/lib/purchase-limit";

type AccessoryRec = {
  id: string;
  slug: string;
  name: string;
  series: string;
  price_cents: number;
  image_urls: string[];
  stock_quantity: number;
};

export function CartDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const cart = useCart();
  const hasCars = cart.items.some((i) => !i.isAddon);

  const { data: accessories } = useQuery({
    enabled: open && hasCars,
    queryKey: ["cart-accessories"],
    queryFn: async () => {
      const { data: cat } = await supabase
        .from("product_categories")
        .select("id")
        .eq("slug", "accessories")
        .maybeSingle();
      if (!cat) return [] as AccessoryRec[];
      const { data } = await supabase
        .from("products")
        .select("id, slug, name, series, price_cents, image_urls, stock_quantity")
        .eq("category_id", cat.id)
        .eq("status", "published")
        .gt("stock_quantity", 0);
      return (data ?? []) as AccessoryRec[];
    },
  });

  // Pick a recommendation that isn't already in the cart. Prefer "Card Protector"
  // when absent, otherwise a random other accessory.
  const recommendation = useMemo<AccessoryRec | null>(() => {
    if (!accessories?.length) return null;
    const inCart = new Set(cart.items.map((i) => i.productId));
    const eligible = accessories.filter((a) => !inCart.has(a.id));
    if (!eligible.length) return null;
    const protector = eligible.find((a) => /card\s*protector/i.test(a.name));
    if (protector) return protector;
    return eligible[Math.floor(Math.random() * eligible.length)];
  }, [accessories, cart.items]);

  const addRecommendation = async () => {
    if (!recommendation) return;
    const ok = await ensurePurchaseAllowed(recommendation.id, 1, recommendation.name);
    if (!ok) return;
    cart.add(
      {
        productId: recommendation.id,
        slug: recommendation.slug,
        name: recommendation.name,
        series: recommendation.series,
        image: recommendation.image_urls[0] ?? null,
        unitPriceCents: recommendation.price_cents,
        stock: recommendation.stock_quantity,
      },
      1,
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
              <ShoppingBag className="h-3.5 w-3.5" />
            </div>
            <SheetTitle className="text-sm font-black uppercase tracking-tight">Your cart</SheetTitle>
          </div>
          <SheetDescription className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {cart.count === 0 ? "Nothing in the garage yet" : `${cart.count} item${cart.count === 1 ? "" : "s"}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full border border-border/60 bg-muted/40">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-1 text-sm font-semibold">Your cart is empty</div>
              <p className="text-xs text-muted-foreground">Add a car to get rolling.</p>
              <Button asChild variant="outline" className="mt-3 rounded-full" onClick={() => onOpenChange(false)}>
                <Link to="/shop">Browse the vault</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {cart.items.map((i) => (
                <li key={i.productId} className="group flex gap-3 rounded-xl border border-border/60 bg-card/40 p-3 transition-colors hover:border-border">
                  <Link
                    to="/shop/$slug"
                    params={{ slug: i.slug }}
                    onClick={() => onOpenChange(false)}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted"
                  >
                    {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : null}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold leading-tight">{i.name}</div>
                        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          {i.series}
                        </div>
                      </div>
                      <button
                        onClick={() => cart.remove(i.productId)}
                        aria-label="Remove"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-full border border-border/70 bg-background/60">
                        <button
                          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                          onClick={() => cart.setQty(i.productId, i.quantity - 1)}
                          disabled={i.quantity <= 1}
                          aria-label="Decrease"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums">{i.quantity}</span>
                        <button
                          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                          onClick={async () => {
                            const ok = await ensurePurchaseAllowed(i.productId, i.quantity + 1, i.name);
                            if (!ok) return;
                            cart.setQty(i.productId, i.quantity + 1);
                          }}
                          disabled={i.quantity >= i.stock}
                          aria-label="Increase"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="font-mono text-sm font-bold tabular-nums">
                        {formatPrice(i.unitPriceCents * i.quantity)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {hasCars && recommendation ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                  {recommendation.image_urls[0] ? (
                    <img src={recommendation.image_urls[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                        <Sparkles className="h-3 w-3" /> You might also like
                      </div>
                      <div className="mt-0.5 truncate text-sm font-bold">{recommendation.name}</div>
                    </div>
                    <div className="whitespace-nowrap font-mono text-sm font-bold text-primary">
                      {formatPrice(recommendation.price_cents)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addRecommendation}
                    className="mt-3 h-8 rounded-full border-primary/60 text-[11px] font-bold uppercase tracking-[0.18em] text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add to cart
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {cart.items.length > 0 ? (
          <div className="border-t border-border/60 bg-card/40 px-5 pb-5 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Subtotal</span>
              <span className="font-mono text-xl font-black tabular-nums">{formatPrice(cart.subtotalCents)}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Taxes & shipping calculated at checkout.</p>
            <Separator className="my-4" />
            <Button asChild size="lg" className="h-12 w-full rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-primary/90">
              <Link to="/checkout" onClick={() => onOpenChange(false)}>Checkout · {formatPrice(cart.subtotalCents)}</Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
