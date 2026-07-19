import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPrice } from "@/lib/format";
import { LogIn, Package, Gavel, Truck, Search, ChevronRight, X } from "lucide-react";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My Orders — The Diecast Vault" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrdersPage,
});

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_cents: number;
  created_at: string;
  tracking_number: string | null;
  auction_log_id: string | null;
  order_items: { id: string; product_name: string; product_image: string | null; quantity: number }[];
};

function OrdersPage() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "packed" | "shipped" | "delivered" | "cancelled">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "auction" | "shop">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "total_desc" | "total_asc">("newest");

  const { data: orders, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      try { await supabase.rpc("link_my_orders"); } catch { /* noop */ }
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, payment_method, total_cents, created_at, tracking_number, auction_log_id, order_items(id, product_name, product_image, quantity)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const filtered = useMemo(() => {
    let list = orders ?? [];
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    if (sourceFilter === "auction") list = list.filter((o) => !!o.auction_log_id);
    if (sourceFilter === "shop")    list = list.filter((o) => !o.auction_log_id);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.order_items.some((i) => i.product_name.toLowerCase().includes(q))
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "newest")      return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === "oldest")      return +new Date(a.created_at) - +new Date(b.created_at);
      if (sort === "total_desc")  return b.total_cents - a.total_cents;
      return a.total_cents - b.total_cents;
    });
    return sorted;
  }, [orders, search, statusFilter, sourceFilter, sort]);

  const stats = useMemo(() => {
    const list = orders ?? [];
    const inTransit = list.filter((o) => ["paid","packed","shipped"].includes(o.status)).length;
    const delivered = list.filter((o) => o.status === "delivered").length;
    const totalSpend = list.reduce((s, o) => s + (o.total_cents ?? 0), 0);
    return { total: list.length, inTransit, delivered, totalSpend };
  }, [orders]);

  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setSourceFilter("all"); setSort("newest"); };
  const hasFilters = search || statusFilter !== "all" || sourceFilter !== "all" || sort !== "newest";

  if (loading) return <SiteShell><div className="py-24 text-center text-sm text-muted-foreground">Loading…</div></SiteShell>;

  if (!user) {
    return (
      <SiteShell>
        <section className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight">Sign in to see orders</h1>
          <Button asChild className="mt-6 rounded-full"><Link to="/auth"><LogIn className="mr-2 h-4 w-4" />Sign in</Link></Button>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        {/* Header */}
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ My orders</div>
        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight md:text-5xl">Order history</h1>

        {/* Summary stats */}
        {(orders?.length ?? 0) > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatChip label="Total" value={String(stats.total)} />
            <StatChip label="In transit" value={String(stats.inTransit)} />
            <StatChip label="Delivered" value={String(stats.delivered)} />
            <StatChip label="Total spend" value={formatPrice(stats.totalSpend)} mono />
          </div>
        ) : null}

        {/* Filter bar */}
        <div className="mt-6 rounded-2xl border border-border/70 bg-card/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order # or item…"
                className="h-9 w-full pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-9 w-[130px] capitalize"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["pending", "paid", "packed", "shipped", "delivered", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="auction">Auction wins</SelectItem>
                <SelectItem value="shop">Shop orders</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="total_desc">Total ↓</SelectItem>
                <SelectItem value="total_asc">Total ↑</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters ? (
              <button
                onClick={clearFilters}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-border/60 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            ) : null}
            <div className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {filtered.length} / {orders?.length ?? 0}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="mt-4 space-y-2.5">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-16 text-center">
              <Package className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {(orders?.length ?? 0) === 0 ? "No orders yet. Go grab something rare." : "No orders match your filters."}
              </p>
              {(orders?.length ?? 0) === 0 ? (
                <Button asChild className="mt-6 rounded-full"><Link to="/shop">Shop the vault</Link></Button>
              ) : (
                <Button variant="outline" className="mt-6" onClick={clearFilters}>Clear filters</Button>
              )}
            </div>
          ) : (
            filtered.map((o) => {
              const firstItem = o.order_items[0];
              const extra = o.order_items.length - 1;
              return (
                <Link
                  key={o.id}
                  to="/orders/$id"
                  params={{ id: o.id }}
                  className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card/40 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg sm:p-4"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
                    {firstItem?.product_image ? (
                      <img src={firstItem.product_image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                    {extra > 0 ? (
                      <span className="absolute bottom-1 right-1 rounded-full bg-background/90 px-1.5 py-0.5 font-mono text-[9px] font-bold">
                        +{extra}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        {o.order_number}
                      </span>
                      {o.auction_log_id ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
                          <Gavel className="h-2.5 w-2.5" /> Auction
                        </span>
                      ) : null}
                      {o.tracking_number ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-blue-400">
                          <Truck className="h-2.5 w-2.5" /> Tracked
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold">
                      {firstItem?.product_name ?? "—"}
                      {extra > 0 ? <span className="ml-1 font-normal text-muted-foreground">+ {extra} more</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className="text-border">•</span>
                      <StatusPill status={o.status} />
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="font-mono text-lg font-bold">{formatPrice(o.total_cents)}</div>
                    <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      {o.payment_method === "cod" ? "Cash on delivery" : "Online"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              );
            })
          )}
        </div>
      </section>
    </SiteShell>
  );
}

function StatChip({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-black ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; label?: string }> = {
    pending:   { bg: "bg-muted text-muted-foreground border-border" },
    paid:      { bg: "bg-primary/15 text-primary border-primary/30", label: "confirmed" },
    packed:    { bg: "bg-accent/15 text-accent border-accent/30" },
    shipped:   { bg: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    delivered: { bg: "bg-green-500/15 text-green-400 border-green-500/30" },
    cancelled: { bg: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const s = map[status] ?? { bg: "bg-muted border-border" };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] ${s.bg}`}>
      {s.label ?? status}
    </span>
  );
}

export function PaymentPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
    paid:     "bg-green-500/15 text-green-400 border-green-500/30",
    refunded: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    failed:   "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] ${map[status] ?? "bg-muted border-border"}`}>
      Payment · {status}
    </span>
  );
}
