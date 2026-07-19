import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { StatusPill, PaymentPill } from "./orders";
import { OrderTimeline } from "@/components/site/OrderTimeline";
import { formatPrice } from "@/lib/format";
import {
  ArrowLeft, Truck, ExternalLink, Download, Printer, MapPin,
  Phone as PhoneIcon, User as UserIcon, Package, Gavel, Copy,
} from "lucide-react";
import { exportOrderPdf, type OrderPdf } from "@/lib/orders-pdf";
import { displayPhone } from "@/lib/phone";
import { toast } from "sonner";

export const Route = createFileRoute("/orders_/$id")({
  head: () => ({
    meta: [
      { title: "Order — The Diecast Vault" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (loading || isLoading)
    return <SiteShell><div className="py-24 text-center text-sm text-muted-foreground">Loading…</div></SiteShell>;
  if (!user)
    return <SiteShell><div className="py-24 text-center"><Button asChild><Link to="/auth">Sign in</Link></Button></div></SiteShell>;
  if (!data)
    return <SiteShell><div className="py-24 text-center text-sm text-muted-foreground">Order not found.</div></SiteShell>;

  const addr = (data.shipping_address ?? {}) as {
    full_name?: string; phone?: string; line1?: string; line2?: string | null;
    city?: string; state?: string; postal_code?: string; country?: string;
  };
  const items = (data.order_items ?? []) as Array<{
    id: string; product_name: string; product_series: string | null;
    product_image: string | null; quantity: number;
    unit_price_cents: number | null; line_total_cents: number;
  }>;

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(data.order_number);
    toast.success("Order number copied");
  };

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14 print:py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> All orders
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => exportOrderPdf(data as unknown as OrderPdf)}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card/60 to-card/20">
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  <span>§ Order</span>
                  {data.auction_log_id ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
                      <Gavel className="h-2.5 w-2.5" /> Auction win
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-2 flex items-center gap-2 text-2xl font-black uppercase tracking-tight md:text-3xl">
                  <span className="font-mono">{data.order_number}</span>
                  <button
                    onClick={copyOrderNumber}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground print:hidden"
                    title="Copy order number"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </h1>
                <div className="mt-1 text-sm text-muted-foreground">
                  Placed on {new Date(data.created_at).toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusPill status={data.status} />
                <PaymentPill status={data.payment_status ?? "pending"} />
              </div>
            </div>
          </div>

          {/* Primary status: timeline */}
          <div className="border-t border-border/60 bg-background/40 p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Tracking progress</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {data.status === "cancelled" ? "Cancelled" : `Stage ${Math.max(1, ["pending","paid","packed","shipped","delivered"].indexOf(data.status) + 1)} of 5`}
              </div>
            </div>
            <div className="hidden md:block">
              <OrderTimeline status={data.status} createdAt={data.created_at} orientation="horizontal" />
            </div>
            <div className="md:hidden">
              <OrderTimeline status={data.status} createdAt={data.created_at} orientation="vertical" compact />
            </div>
          </div>


          {/* Tracking banner (only if present) */}
          {data.tracking_number ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-primary/5 p-4 md:px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Tracking number</div>
                  <div className="font-mono text-sm font-bold">{data.tracking_number}</div>
                </div>
              </div>
              {data.tracking_url ? (
                <Button asChild size="sm" variant="outline">
                  <a href={data.tracking_url} target="_blank" rel="noreferrer">
                    Track shipment <ExternalLink className="ml-1.5 h-3 w-3" />
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>


        {/* Body grid */}
        <div className="mt-6 grid gap-6 md:grid-cols-[1.6fr_1fr]">
          {/* Items */}
          <div className="rounded-2xl border border-border/70 bg-card/40">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                <Package className="h-3 w-3" /> Items ({items.length})
              </div>
            </div>
            <ul className="divide-y divide-border/60">
              {items.map((i) => (
                <li key={i.id} className="flex gap-4 p-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {i.product_image ? <img src={i.product_image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{i.product_name}</div>
                    {i.product_series ? (
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        {i.product_series}
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Qty {i.quantity} · {formatPrice(i.unit_price_cents ?? Math.round(i.line_total_cents / Math.max(1, i.quantity)))} each
                    </div>
                  </div>
                  <div className="text-right font-mono text-sm font-semibold">{formatPrice(i.line_total_cents)}</div>
                </li>
              ))}
            </ul>

            {/* Totals inline (single source of truth) */}
            <div className="space-y-1.5 border-t border-border/60 px-5 py-4 text-sm">
              <Row label="Subtotal" value={formatPrice(data.subtotal_cents)} />
              {(data.discount_cents ?? 0) > 0 ? (
                <Row label={`Discount${data.coupon_code ? ` (${data.coupon_code})` : ""}`} value={`− ${formatPrice(data.discount_cents ?? 0)}`} />
              ) : null}
              <Row label="GST" value={formatPrice(data.tax_cents)} />
              <Row label="Shipping" value={data.shipping_cents === 0 ? "Free" : formatPrice(data.shipping_cents)} />
              <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-sm font-semibold">Total</span>
                <span className="font-mono text-xl font-black">{formatPrice(data.total_cents)}</span>
              </div>
              <div className="pt-1 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Paid via {data.payment_method === "cod" ? "Cash on delivery" : "Online"}
              </div>
            </div>
          </div>

          {/* Meta column */}
          <div className="space-y-4">
            <Card title={<><MapPin className="h-3 w-3" /> Shipping to</>}>
              <div className="text-sm leading-relaxed">
                <div className="font-semibold">{addr.full_name ?? "—"}</div>
                {addr.phone ? (
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                    <PhoneIcon className="h-3 w-3" /> {displayPhone(addr.phone)}
                  </div>
                ) : null}
                <div className="mt-3 space-y-0.5 text-sm text-muted-foreground">
                  {addr.line1 ? <div>{addr.line1}</div> : null}
                  {addr.line2 ? <div>{addr.line2}</div> : null}
                  <div>{[addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")}</div>
                  {addr.country ? <div>{addr.country}</div> : null}
                </div>
              </div>
            </Card>

            <Card title={<><UserIcon className="h-3 w-3" /> Contact</>}>
              <div className="space-y-1 text-sm">
                <div className="text-muted-foreground">Email</div>
                <div className="truncate font-medium">{data.contact_email ?? "—"}</div>
              </div>
            </Card>

            {data.notes ? (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400">Your note</div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{data.notes}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
      <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
