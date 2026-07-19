import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, RequiredMark } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ImageUploader } from "@/components/site/ImageUploader";
import { ImageDropField } from "@/components/site/ImageDropField";
import { FlashBannerStrip, flashBannerLabel, type FlashBannerItem } from "@/components/site/FlashBannerStrip";
import { useConfirm, usePrompt } from "@/components/ui/use-confirm";
import {
  SETTINGS_DEFAULTS, type SettingKey,
  GENERAL_DEFAULTS, type GeneralConfig,
  HERO_DEFAULTS, type HomepageHeroConfig,
  SECTIONS_DEFAULTS, type HomepageSectionsConfig,
  SHOP_DEFAULTS, type ShopConfig,
  INVENTORY_DEFAULTS, type InventoryConfig,
  SOCIAL_DEFAULTS, type SocialLinks,
  FOOTER_DEFAULTS, type FooterConfig, type FooterLink,
  NOTIF_DEFAULTS, type NotificationPrefs,
} from "@/hooks/use-site-settings";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { FLASH_THEMES, themeColor, themeLabel, type FlashTheme } from "@/lib/flash-themes";
import { StatusPill, PaymentPill } from "./orders";
import { OrderTimeline } from "@/components/site/OrderTimeline";
import { formatPrice } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { exportOrdersPdf, exportOrderPdf, exportAuditLogsPdf, orderToCsvRows, type OrderPdf } from "@/lib/orders-pdf";
import { displayPhone } from "@/lib/phone";
import { toast } from "sonner";
import { LogIn, Plus, Package, ShoppingBag, IndianRupee, Users, Star, Tag, ScrollText, ShieldCheck, TrendingUp, Trash2, ChevronRight, Settings as SettingsIcon, Gavel, Save, Radio, Download, Megaphone, Pin, PinOff, CheckCircle2, Circle, XCircle, Printer, StickyNote, User as UserIcon, Truck, Mail, Phone as PhoneIcon, MapPin, FileText, Search, Bell, Sparkles, AlertTriangle, Zap, Send, Eye, Filter as FilterIcon, X as XIcon, Info, Link2, Image as ImageIcon, Upload, ExternalLink, GripVertical, Type as TypeIcon } from "lucide-react";

// ---------- Audit helper ----------
async function logAction(action: string, entity_type: string, entity_id?: string | null, metadata?: Record<string, unknown>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("audit_log").insert({
    actor_id: u.user.id,
    actor_email: u.user.email ?? null,
    action, entity_type,
    entity_id: entity_id ?? null,
    metadata: (metadata ?? null) as never,
  });
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — The Diecast Vault" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isStaff, setIsStaff] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setIsStaff(false); return; }
    Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: user.id, _role: "staff" }),
    ]).then(([a, s]) => { setIsAdmin(!!a.data); setIsStaff(!!s.data); });
  }, [user]);

  if (loading || isAdmin === null || isStaff === null) {
    return <SiteShell><div className="py-24 text-center text-sm text-muted-foreground">Loading…</div></SiteShell>;
  }

  if (!user) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight">Admin only</h1>
          <Button asChild className="mt-6 rounded-full"><Link to="/auth"><LogIn className="mr-2 h-4 w-4" />Sign in</Link></Button>
        </div>
      </SiteShell>
    );
  }

  if (!isAdmin && !isStaff) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight">Not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your account doesn't have staff or admin access.</p>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          § {isAdmin ? "Admin" : "Staff"}
        </div>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-tight md:text-5xl">Vault control</h1>

        <Metrics />

        <Tabs defaultValue="products" className="mt-10">
          <TabsList className="flex w-full flex-wrap h-auto gap-1 p-1.5">
            <TabsTrigger value="products" className="flex-1 min-w-[110px] px-5 py-2.5 text-sm font-semibold">Products</TabsTrigger>
            <TabsTrigger value="orders" className="flex-1 min-w-[110px] px-5 py-2.5 text-sm font-semibold">Orders</TabsTrigger>
            <TabsTrigger value="community" className="flex-1 min-w-[110px] px-5 py-2.5 text-sm font-semibold">Community</TabsTrigger>
            <TabsTrigger value="coupons" className="flex-1 min-w-[110px] px-5 py-2.5 text-sm font-semibold">Coupons</TabsTrigger>
            <TabsTrigger value="auctions" className="flex-1 min-w-[110px] px-5 py-2.5 text-sm font-semibold">Auctions</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1 min-w-[110px] px-5 py-2.5 text-sm font-semibold">Analytics</TabsTrigger>
            <TabsTrigger value="audit" className="flex-1 min-w-[110px] px-5 py-2.5 text-sm font-semibold">Audit</TabsTrigger>
            <TabsTrigger value="badges" className="flex-1 min-w-[110px] px-5 py-2.5 text-sm font-semibold">Badges</TabsTrigger>
            {isAdmin ? <TabsTrigger value="roles" className="flex-1 min-w-[110px] px-5 py-2.5 text-sm font-semibold">Roles</TabsTrigger> : null}
            {isAdmin ? <TabsTrigger value="settings" className="flex-1 min-w-[110px] px-5 py-2.5 text-sm font-semibold">Settings</TabsTrigger> : null}
          </TabsList>
          <TabsContent value="products" className="mt-6"><ProductsAdmin /></TabsContent>
          <TabsContent value="orders" className="mt-6"><OrdersSection /></TabsContent>
          <TabsContent value="community" className="mt-6">
            <Tabs defaultValue="customers">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="customers" className="px-5 py-2 text-sm font-semibold">Customers</TabsTrigger>
                <TabsTrigger value="reviews" className="px-5 py-2 text-sm font-semibold">Reviews</TabsTrigger>
              </TabsList>
              <TabsContent value="customers" className="mt-4"><CustomersAdmin /></TabsContent>
              <TabsContent value="reviews" className="mt-4"><ReviewsAdmin /></TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="coupons" className="mt-6"><CouponsAdmin /></TabsContent>
          <TabsContent value="auctions" className="mt-6"><AuctionsSection /></TabsContent>
          <TabsContent value="analytics" className="mt-6"><AnalyticsAdmin /></TabsContent>
          <TabsContent value="audit" className="mt-6"><AuditAdmin /></TabsContent>
          <TabsContent value="badges" className="mt-6"><BadgesAdmin /></TabsContent>
          {isAdmin ? <TabsContent value="roles" className="mt-6"><RolesAdmin /></TabsContent> : null}
          {isAdmin ? <TabsContent value="settings" className="mt-6"><SettingsAdmin /></TabsContent> : null}
        </Tabs>
      </section>
    </SiteShell>
  );
}

function Metrics() {
  const { data } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const [{ count: productCount }, { count: orderCount }, { data: orders }, { data: items }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("total_cents, user_id"),
        supabase.from("order_items").select("quantity, products(series)"),
      ]);
      const revenue = (orders ?? []).reduce((s, o) => s + o.total_cents, 0);
      const customersOrdered = new Set((orders ?? []).map((o) => o.user_id)).size;
      const CAR_SERIES = new Set(["Mainline", "Redlines", "Treasure Hunts", "Premium", "Team Transport"]);
      let carsSold = 0;
      let othersSold = 0;
      for (const it of (items ?? []) as Array<{ quantity: number; products: { series: string | null } | null }>) {
        const series = it.products?.series ?? "";
        if (CAR_SERIES.has(series)) carsSold += it.quantity;
        else othersSold += it.quantity;
      }
      return { productCount: productCount ?? 0, orderCount: orderCount ?? 0, revenue, customersOrdered, carsSold, othersSold };
    },
  });
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Stat icon={Package} label="Products" value={String(data?.productCount ?? "–")} />
      <Stat icon={ShoppingBag} label="Orders" value={String(data?.orderCount ?? "–")} />
      <Stat icon={IndianRupee} label="Revenue" value={data ? formatPrice(data.revenue) : "–"} />
      <Stat icon={Users} label="Customers Ordered" value={String(data?.customersOrdered ?? "–")} />
      <Stat icon={Package} label="Cars Sold" value={String(data?.carsSold ?? "–")} />
      <Stat icon={Package} label="Others Sold" value={String(data?.othersSold ?? "–")} />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 font-mono text-3xl font-bold">{value}</div>
    </div>
  );
}

function ProductsAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [seriesFilter, setSeriesFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { data: categories } = useCategories();
  const [initialCategoryId, setInitialCategoryId] = useState<string | null>(null);
  const qcTop = qc;
  const { confirm, confirmDialog } = useConfirm();
  const { prompt, promptDialog } = usePrompt();

  async function createCategoryInline(): Promise<string | null> {
    const raw = await prompt({
      title: "New category",
      description: "This will appear in the shop and product filters.",
      label: "Category name",
      placeholder: "e.g. Action Figures",
      confirmText: "Create",
    });
    const name = raw?.trim();
    if (!name) return null;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) { toast.error("Category name must contain letters or numbers"); return null; }
    const { data, error } = await supabase
      .from("product_categories")
      .insert({ name, slug, sort_order: (categories?.length ?? 0) * 10 + 100 })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return null; }
    await qcTop.invalidateQueries({ queryKey: ["product_categories"] });
    toast.success(`Category "${name}" added`);
    return data.id as string;
  }

  function startNewProduct(categoryId: string | null) {
    setEditing(null);
    setInitialCategoryId(categoryId);
    setOpen(true);
  }

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (p: { id: string; name: string }) => {
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) throw error;
      await logAction("product.delete", "product", p.id, { name: p.name });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); toast.success("Product deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (products ?? []).filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (seriesFilter !== "all" && p.series !== seriesFilter) return false;
    if (categoryFilter !== "all" && (p as { category_id: string | null }).category_id !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{filtered.length} / {products?.length ?? 0} products</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="rounded-full"><Plus className="mr-2 h-4 w-4" />New product</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Choose category</DropdownMenuLabel>
            {(categories ?? []).map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => startNewProduct(c.id)}>{c.name}</DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => startNewProduct(null)}>Uncategorized</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                createCategoryInline().then((id) => { if (id) startNewProduct(id); });
              }}
            >
              <Plus className="mr-2 h-3.5 w-3.5" /> New category…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search name or slug…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 max-w-xs" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Select value={seriesFilter} onValueChange={setSeriesFilter}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Series" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All series</SelectItem>
            {["Mainline", "Premium", "Team Transport", "Redlines", "Treasure Hunts"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Series</th>
              <th className="p-3">Status</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border/60">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-muted">
                      {p.image_urls?.[0] ? <img src={p.image_urls[0]} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0"><div className="truncate font-semibold">{p.name}</div><div className="truncate text-xs text-muted-foreground">{p.slug}</div></div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{p.series}</td>
                <td className="p-3">
                  {p.status === "draft" ? (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-500 text-[10px] uppercase tracking-wider">Draft</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">Published</Badge>
                  )}
                </td>
                <td className="p-3 font-mono">{formatPrice(p.price_cents)}</td>
                <td className="p-3 font-mono">{p.stock_quantity}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(p as Product); setOpen(true); }}>Edit</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Delete "${p.name}"?`,
                          description: "This can't be undone.",
                          confirmText: "Delete",
                          destructive: true,
                        });
                        if (ok) del.mutate({ id: p.id, name: p.name });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ProductDialog open={open} onOpenChange={setOpen} product={editing} initialCategoryId={initialCategoryId} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-products"] })} />
      {confirmDialog}
      {promptDialog}
    </div>
  );
}

type Product = {
  id: string; name: string; slug: string; series: string; year: number | null;
  price_cents: number; stock_quantity: number; low_stock_threshold: number;
  rarity: string | null; color: string | null; description: string | null;
  image_urls: string[]; featured: boolean;
  status: "draft" | "published";
  meta_title: string | null; meta_description: string | null; og_image_url: string | null;
  category_id: string | null; coming_soon: boolean;
  max_per_customer: number;
};

type Category = { id: string; slug: string; name: string; sort_order: number };

function useCategories() {
  return useQuery({
    queryKey: ["product_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, slug, name, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

function rupeesToCents(value: string) {
  const trimmed = value.replace(/,/g, "").trim();
  if (!trimmed) return 0;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function ProductDialog({ open, onOpenChange, product, initialCategoryId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; product: Product | null; initialCategoryId?: string | null; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Product>>({});
  const [costCents, setCostCents] = useState<number>(0);
  const [sellingTouched, setSellingTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data: categories } = useCategories();
  const { defaultLowStockThreshold } = useSiteSettings();
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const selectedCategory = (categories ?? []).find((c) => c.id === f.category_id) ?? null;
  const isAccessory = selectedCategory?.slug === "accessories";
  useEffect(() => {
    setF(product ?? { series: "Mainline", stock_quantity: 1, low_stock_threshold: defaultLowStockThreshold, featured: false, image_urls: [], status: "published", coming_soon: false, category_id: initialCategoryId ?? null });
    setSellingTouched(!!product);
    setFormError(null);
    setShowNewCat(false);
    setNewCatName("");
  }, [product, open, initialCategoryId, defaultLowStockThreshold]);

  // Auto-generate slug from name for accessories (no manual slug field shown)
  useEffect(() => {
    if (!isAccessory || product) return;
    const s = (f.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (s && s !== f.slug) setF((c) => ({ ...c, slug: s, series: c.series ?? "Accessory" }));
  }, [f.name, isAccessory, product]);

  async function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) { toast.error("Category name must contain letters or numbers"); return; }
    setAddingCat(true);
    try {
      const { data, error } = await supabase
        .from("product_categories")
        .insert({ name, slug, sort_order: (categories?.length ?? 0) * 10 + 100 })
        .select("id, slug, name, sort_order")
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["product_categories"] });
      setF((c) => ({ ...c, category_id: data.id }));
      setNewCatName("");
      setShowNewCat(false);
      toast.success(`Category "${name}" added`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add category");
    } finally {
      setAddingCat(false);
    }
  }

  // Load private buying price (staff/admin only via RLS)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!product?.id) { setCostCents(0); return; }
      const { data } = await supabase.from("product_costs" as any).select("cost_cents").eq("product_id", product.id).maybeSingle();
      if (!cancelled) setCostCents(((data as any)?.cost_cents as number) ?? 0);
    })();
    return () => { cancelled = true; };
  }, [product?.id, open]);

  const profitCents = (f.price_cents ?? 0) - costCents;
  const profitPct = costCents > 0 ? Math.round((profitCents / costCents) * 100) : 0;

  async function save(statusOverride?: "draft" | "published") {
    if (saving) return;
    setFormError(null);
    const nextStatus = statusOverride ?? f.status ?? "published";
    const missing: string[] = [];
    if (!f.name?.trim()) missing.push("Name");
    if (!f.slug?.trim()) missing.push("Slug");
    if (!f.series?.trim()) missing.push("Series");
    if (f.price_cents == null || Number(f.price_cents) <= 0) missing.push("Price");
    if (f.stock_quantity == null || Number(f.stock_quantity) < 0) missing.push("Stock");
    if (!f.image_urls || f.image_urls.length === 0) missing.push("At least 1 image");
    if (missing.length) {
      const message = `Please fill in: ${missing.join(", ")}`;
      setFormError(message);
      toast.error(message, { duration: 6000 });
      return;
    }
    if (f.slug && !/^[a-z0-9-]+$/.test(f.slug)) {
      const message = "Slug must be lowercase letters, numbers, and dashes only";
      setFormError(message);
      toast.error(message, { duration: 6000 });
      return;
    }
    if (costCents > 0 && (f.price_cents ?? 0) < costCents) {
      const ok = await confirm({
        title: "Selling below cost?",
        description: "Your selling price is below your buying price — you'll lose money on each sale. Continue?",
        confirmText: "Continue",
        destructive: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
    const payload = {
      name: f.name ?? "",
      slug: f.slug ?? "",
      series: f.series ?? "Mainline",
      year: f.year ?? null,
      price_cents: Number(f.price_cents ?? 0),
      stock_quantity: Number(f.stock_quantity ?? 0),
      low_stock_threshold: Number(f.low_stock_threshold ?? 3),
      rarity: f.rarity ?? null,
      color: f.color ?? null,
      description: f.description ?? null,
      image_urls: f.image_urls ?? [],
      featured: !!f.featured,
      status: nextStatus as "draft" | "published",
      meta_title: f.meta_title ?? null,
      meta_description: f.meta_description ?? null,
      og_image_url: f.og_image_url ?? null,
      category_id: f.category_id ?? null,
      coming_soon: !!f.coming_soon,
      max_per_customer: Math.max(0, Number(f.max_per_customer ?? 0)),
    };
    const q = product
      ? supabase.from("products").update(payload).eq("id", product.id)
      : supabase.from("products").insert(payload);
    const { data: savedProduct, error } = await q.select("id").single();
    if (error) {
      setFormError(error.message);
      toast.error(error.message, { duration: 7000 });
      return;
    }
    // Save private buying price
    const savedId = product?.id ?? savedProduct?.id;
    if (savedId) {
      const { error: costErr } = await supabase
        .from("product_costs" as any)
        .upsert({ product_id: savedId, cost_cents: Math.max(0, Math.round(costCents || 0)) }, { onConflict: "product_id" });
      if (costErr) toast.error("Product saved, but buying price failed: " + costErr.message);
    }
    setF((c) => ({ ...c, status: nextStatus as "draft" | "published" }));
    await logAction(product ? "product.update" : "product.create", "product", product?.id ?? null, { name: payload.name });
    toast.success(
      product
        ? nextStatus === "draft" ? "Saved as draft" : "Published — live on the shop"
        : nextStatus === "draft" ? "Draft created" : "Product published — live on the shop"
    );
    onSaved();
    onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setFormError("Save failed: " + msg);
      toast.error("Save failed: " + msg);
      console.error("[admin save]", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">{product ? "Edit product" : "New product"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {product ? "Update the vault listing. Changes go live instantly." : "Add a new die-cast to the vault. Slug becomes the shop URL."}
          </p>
        </DialogHeader>

        <div className="mt-2 space-y-6">
          {isAccessory ? (
            <>
              <Section title="Accessory">
                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="Name" hint="displayed on cards" required>
                    <Input required placeholder="e.g. Card Protector Case" value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} />
                  </F>
                  <F label="Price (₹)" hint="what customers pay" required>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">₹</span>
                      <Input
                        required
                        type="text"
                        inputMode="decimal"
                        className="pl-7"
                        placeholder="e.g. 249"
                        value={f.price_cents != null ? (f.price_cents / 100) : ""}
                        onChange={(e) => setF({ ...f, price_cents: rupeesToCents(e.target.value) || undefined })}
                      />
                    </div>
                  </F>
                  <F label="Quantity in stock" required>
                    <Input required type="number" min={0} value={f.stock_quantity ?? 0} onChange={(e) => setF({ ...f, stock_quantity: Number(e.target.value) })} />
                  </F>
                  <F label="Limit per customer" hint="0 = unlimited">
                    <Input type="number" min={0} value={f.max_per_customer ?? 0} onChange={(e) => setF({ ...f, max_per_customer: Number(e.target.value) })} placeholder="0" />
                  </F>
                  <F label="Coming soon" hint="hide price, disable cart">
                    <div className="flex h-10 items-center gap-3 rounded-md border border-border/60 px-3">
                      <Switch checked={!!f.coming_soon} onCheckedChange={(v) => setF({ ...f, coming_soon: v })} />
                      <span className="text-sm text-muted-foreground">
                        {f.coming_soon ? "Marked coming soon" : "Available"}
                      </span>
                    </div>
                  </F>
                </div>
                <div className="mt-4">
                  <F label="Image" hint="drag to reorder — first is the cover" required>
                    <ImageUploader urls={f.image_urls ?? []} onChange={(next) => setF({ ...f, image_urls: next })} />
                  </F>
                </div>
                <div className="mt-4">
                  <F label="Description" hint="short pitch">
                    <Textarea rows={3} placeholder="Crystal-clear hard shell for mint carded cars." value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
                  </F>
                </div>
              </Section>
            </>
          ) : (
            <>
          <Section title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Name" hint="displayed on cards" required><Input required placeholder="e.g. Blitzspeeder GT" value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></F>
              <F label="Slug" hint="URL — lowercase, no spaces" required><Input required placeholder="blitzspeeder-gt" value={f.slug ?? ""} onChange={(e) => setF({ ...f, slug: e.target.value })} /></F>
              <F label="Series" hint="Hot Wheels line" required>
                <Select value={f.series ?? "Mainline"} onValueChange={(v) => setF({ ...f, series: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Mainline", "Premium", "Team Transport", "Redlines", "Treasure Hunts"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label="Year" hint="model year, e.g. 2024"><Input type="number" placeholder="2024" value={f.year ?? ""} onChange={(e) => setF({ ...f, year: e.target.value ? Number(e.target.value) : null })} /></F>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <F label="Category" hint="Hot Wheels, accessories, etc.">
                <div className="flex gap-2">
                  <Select value={f.category_id ?? "__none"} onValueChange={(v) => setF({ ...f, category_id: v === "__none" ? null : v })}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Choose category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Uncategorized</SelectItem>
                      {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewCat((v) => !v)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {showNewCat ? (
                  <div className="mt-2 flex gap-2">
                    <Input
                      placeholder="e.g. Action Figures"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                    />
                    <Button type="button" size="sm" disabled={addingCat || !newCatName.trim()} onClick={addCategory}>
                      {addingCat ? "Adding…" : "Add"}
                    </Button>
                  </div>
                ) : null}
              </F>
              <F label="Coming soon" hint="hide price and disable cart for this item">
                <div className="flex h-10 items-center gap-3 rounded-md border border-border/60 px-3">
                  <Switch checked={!!f.coming_soon} onCheckedChange={(v) => setF({ ...f, coming_soon: v })} />
                  <span className="text-sm text-muted-foreground">
                    {f.coming_soon ? "Shown as Coming soon on the shop" : "Available for purchase"}
                  </span>
                </div>
              </F>
            </div>
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">
                Current status: <span className="font-semibold text-foreground">{f.status === "published" ? "Published (live on the shop)" : "Draft (hidden from the shop)"}</span>. Use the buttons at the bottom to save as draft or publish.
              </div>
            </div>
          </Section>

          <Section title="Pricing & stock">
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Staff & admin only — never shown to customers</span>
              </div>
              <F label="Your buying price / MRP (₹)" hint="what YOU paid — used to calculate profit">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">₹</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="pl-7"
                    placeholder="e.g. 200"
                    value={costCents ? costCents / 100 : ""}
                    onChange={(e) => {
                      setCostCents(rupeesToCents(e.target.value));
                    }}
                  />
                </div>
              </F>
              {costCents > 0 && (f.price_cents ?? 0) > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-background/50 p-2 text-center font-mono text-[11px]">
                  <div><div className="text-[9px] uppercase text-muted-foreground">Cost</div><div>₹{(costCents / 100).toLocaleString("en-IN")}</div></div>
                  <div><div className="text-[9px] uppercase text-muted-foreground">Profit</div><div className={profitCents >= 0 ? "text-primary" : "text-destructive"}>₹{(profitCents / 100).toLocaleString("en-IN")}</div></div>
                  <div><div className="text-[9px] uppercase text-muted-foreground">Profit %</div><div className={profitCents >= 0 ? "text-primary" : "text-destructive"}>{profitPct}%</div></div>
                </div>
              ) : (
                <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Enter buying price + selling price (below) to see profit & margin.
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Selling price (₹)" hint="what customers pay" required>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">₹</span>
                  <Input
                    required
                    type="text"
                    inputMode="decimal"
                    className="pl-7"
                    placeholder="e.g. 300"
                    value={f.price_cents != null ? (f.price_cents / 100) : ""}
                    onChange={(e) => {
                      setSellingTouched(true);
                      setF({ ...f, price_cents: rupeesToCents(e.target.value) || undefined });
                    }}
                  />
                </div>
              </F>
              <F label="Stock" hint="units available" required><Input required type="number" min={0} value={f.stock_quantity ?? 0} onChange={(e) => setF({ ...f, stock_quantity: Number(e.target.value) })} /></F>
              <F label="Limit per customer" hint="0 = unlimited">
                <Input type="number" min={0} value={f.max_per_customer ?? 0} onChange={(e) => setF({ ...f, max_per_customer: Number(e.target.value) })} placeholder="0" />
              </F>
            </div>
          </Section>

          <Section title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Color" hint="primary body color"><Input placeholder="e.g. Metallic Red" value={f.color ?? ""} onChange={(e) => setF({ ...f, color: e.target.value })} /></F>
            </div>
          </Section>

          <Section title="Media & copy">
            <F label="Images" hint="drag to reorder — first is the cover" required>
              <ImageUploader urls={f.image_urls ?? []} onChange={(next) => setF({ ...f, image_urls: next })} />
            </F>
            <div className="mt-4">
              <F label="Description" hint="short pitch shown on product page">
                <Textarea rows={3} placeholder="A short, punchy description of the car." value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
              </F>
            </div>
          </Section>

          <Section title="SEO & social">
            <div className="grid gap-4">
              <F label="Meta title" hint="≤ 60 chars — Google result title"><Input maxLength={70} value={f.meta_title ?? ""} onChange={(e) => setF({ ...f, meta_title: e.target.value })} placeholder="Leave blank to use product name" /></F>
              <F label="Meta description" hint="≤ 160 chars — Google snippet"><Textarea rows={2} maxLength={200} value={f.meta_description ?? ""} onChange={(e) => setF({ ...f, meta_description: e.target.value })} placeholder="Leave blank to use description" /></F>
              <F label="Share image URL" hint="shown on WhatsApp / X previews"><Input value={f.og_image_url ?? ""} onChange={(e) => setF({ ...f, og_image_url: e.target.value })} placeholder="Leave blank to use cover image" /></F>
            </div>
          </Section>
            </>
          )}
        </div>

        {formError ? (
          <div className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="outline"
            onClick={() => save("draft")}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save as draft"}
          </Button>
          <Button
            onClick={async () => {
              const ok = await confirm({
                title: "Publish this product?",
                description: "It will be live on the shop and visible to all customers immediately.",
                confirmText: "Publish",
              });
              if (ok) save("published");
            }}
            disabled={saving}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? "Publishing…" : "Publish"}
          </Button>
        </div>
        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-primary">§ {title}</div>
      {children}
    </div>
  );
}

function F({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
        {required ? <RequiredMark /> : null}
        {hint ? <span className="ml-1.5 normal-case tracking-normal text-muted-foreground/60">({hint})</span> : null}
      </Label>
      {children}
    </div>
  );
}

function OrdersSection() {
  return (
    <Tabs defaultValue="active">
      <TabsList className="flex w-full flex-wrap h-auto gap-1 p-1.5 bg-muted/30">
        <TabsTrigger value="active" className="flex-1 min-w-[130px] px-4 py-2 text-sm font-semibold">Orders</TabsTrigger>
        <TabsTrigger value="archived" className="flex-1 min-w-[130px] px-4 py-2 text-sm font-semibold">Archived</TabsTrigger>
        <TabsTrigger value="logs" className="flex-1 min-w-[130px] px-4 py-2 text-sm font-semibold">Logs</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="mt-6"><OrdersAdmin archived={false} /></TabsContent>
      <TabsContent value="archived" className="mt-6"><OrdersAdmin archived={true} /></TabsContent>
      <TabsContent value="logs" className="mt-6"><OrderLogsAdmin /></TabsContent>
    </Tabs>
  );
}

function OrdersAdmin({ archived = false }: { archived?: boolean }) {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const { data: orders } = useQuery({
    queryKey: ["admin-orders", archived ? "archived" : "active"],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, order_number, status, payment_status, payment_method, total_cents, created_at, contact_email, user_id, tracking_number, tracking_url, notes, admin_notes, shipping_address, coupon_code, discount_cents, archived_at, order_items(id)")
        .order("created_at", { ascending: false });
      q = archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch display names for the visible orders' customers so search / display works by name.
  const userIds = Array.from(new Set((orders ?? []).map((o) => o.user_id).filter(Boolean))) as string[];
  const { data: profileMap } = useQuery({
    enabled: userIds.length > 0,
    queryKey: ["admin-orders-profiles", userIds.sort().join(",")],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.id] = p.display_name ?? "";
      return map;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "paid" | "packed" | "shipped" | "delivered" | "cancelled" }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
      await logAction("order.status_change", "order", id, { status });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); toast.success("Order status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, payment_status }: { id: string; payment_status: "pending" | "paid" | "refunded" | "failed" }) => {
      const { error } = await supabase.from("orders").update({ payment_status }).eq("id", id);
      if (error) throw error;
      await logAction("order.payment_status_change", "order", id, { payment_status });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); toast.success("Payment status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-orders", "active"] });
    qc.invalidateQueries({ queryKey: ["admin-orders", "archived"] });
    qc.invalidateQueries({ queryKey: ["order-logs"] });
  };

  const archive = useMutation({
    mutationFn: async ({ id }: { id: string; order_number: string }) => {
      const { error } = await supabase.from("orders").update({ archived_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Order archived"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async ({ id }: { id: string; order_number: string }) => {
      const { error } = await supabase.from("orders").update({ archived_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Order restored"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const permDelete = useMutation({
    mutationFn: async ({ id }: { id: string; order_number: string }) => {
      await supabase.from("order_items").delete().eq("order_id", id);
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Order permanently deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [tracking, setTracking] = useState<{ id: string; tracking_number: string; tracking_url: string } | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "packed" | "shipped" | "delivered" | "cancelled">("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "pending" | "paid" | "refunded" | "failed">("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "cod" | "online">("all");

  function ordersToCsvRows(rows: typeof filtered) {
    return rows.map((o) => {
      const addr = ((o as { shipping_address?: Record<string, string> | null }).shipping_address ?? {}) as Record<string, string>;
      return {
        order_number: o.order_number,
        customer_name: profileMap?.[o.user_id ?? ""] ?? addr.full_name ?? "",
        customer_email: o.contact_email,
        country_code: addr.country_code ?? "+91",
        customer_phone: addr.phone ?? "",
        order_status: o.status,
        payment_status: o.payment_status,
        payment_method: o.payment_method,
        total_inr: Math.round(o.total_cents / 100),
        item_count: o.order_items?.length ?? 0,
        tracking_number: o.tracking_number ?? "",
        tracking_url: o.tracking_url ?? "",
        coupon_code: o.coupon_code ?? "",
        customer_note: (o as { notes?: string | null }).notes ?? "",
        admin_note: (o as { admin_notes?: string | null }).admin_notes ?? "",
        created_at: o.created_at,
      };
    });
  }

  async function fetchOrderFull(id: string): Promise<OrderPdf | null> {
    const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
    if (error || !data) { toast.error(error?.message ?? "Order not found"); return null; }
    return data as unknown as OrderPdf;
  }

  const filtered = (orders ?? []).filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (paymentFilter !== "all" && o.payment_status !== paymentFilter) return false;
    if (methodFilter !== "all" && o.payment_method !== methodFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const qDigits = q.replace(/\D+/g, "");
      const addr = ((o as { shipping_address?: Record<string, string> | null }).shipping_address ?? {}) as Record<string, string>;
      const phoneDigits = (addr.phone ?? "").replace(/\D+/g, "");
      const name = (profileMap?.[o.user_id ?? ""] ?? addr.full_name ?? "").toLowerCase();
      const matches =
        o.order_number.toLowerCase().includes(q) ||
        (o.contact_email ?? "").toLowerCase().includes(q) ||
        name.includes(q) ||
        (qDigits.length >= 3 && phoneDigits.includes(qDigits));
      if (!matches) return false;
    }
    return true;
  });

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (paymentFilter !== "all" ? 1 : 0) +
    (methodFilter !== "all" ? 1 : 0) +
    (search ? 1 : 0);
  const clearAdminFilters = () => {
    setSearch(""); setStatusFilter("all"); setPaymentFilter("all"); setMethodFilter("all");
  };

  return (
    <>
    {/* Filter toolbar */}
    <div className="mb-4 rounded-2xl border border-border/70 bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Order #, name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-9 w-[140px] capitalize"><SelectValue placeholder="Order status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["pending", "paid", "packed", "shipped", "delivered", "cancelled"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as typeof paymentFilter)}>
          <SelectTrigger className="h-9 w-[140px] capitalize"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            {["pending", "paid", "refunded", "failed"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v as typeof methodFilter)}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            <SelectItem value="cod">Cash on delivery</SelectItem>
            <SelectItem value="online">Online</SelectItem>
          </SelectContent>
        </Select>
        {activeFilterCount > 0 ? (
          <button onClick={clearAdminFilters} className="inline-flex h-9 items-center gap-1 rounded-md border border-border/60 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive">
            <XIcon className="h-3 w-3" /> Clear ({activeFilterCount})
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {filtered.length} / {orders?.length ?? 0}
          </div>
          <div className="h-5 w-px bg-border/60" />
          <Button variant="outline" size="sm" onClick={() => downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, ordersToCsvRows(filtered))}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" disabled={filtered.length === 0} onClick={async () => {
            const full = await Promise.all(filtered.map((o) => fetchOrderFull(o.id)));
            exportOrdersPdf(full.filter(Boolean) as OrderPdf[]);
          }}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/20">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <tr>
            <th className="w-8 py-3 pl-4"></th>
            <th className="py-3 pr-3">Order</th>
            <th className="py-3 pr-3">Customer</th>
            <th className="py-3 pr-3 text-right">Total</th>
            <th className="py-3 pr-3">Status</th>
            <th className="py-3 pr-3">Update</th>
            <th className="py-3 pr-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={7} className="p-16 text-center">
              <Package className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {(orders?.length ?? 0) === 0 ? (archived ? "No archived orders." : "No orders yet.") : "No orders match your filters."}
              </p>
              {activeFilterCount > 0 ? (
                <Button variant="outline" size="sm" className="mt-4" onClick={clearAdminFilters}>Clear filters</Button>
              ) : null}
            </td></tr>
          ) : null}
          {filtered.map((o) => {
            const addr = ((o as { shipping_address?: Record<string, string> | null }).shipping_address ?? {}) as Record<string, string>;
            const customerName = profileMap?.[o.user_id ?? ""] ?? addr.full_name ?? "—";
            const isOpen = expandedRow === o.id;
            return (
            <Fragment key={o.id}>
            <tr className={`border-t border-border/60 transition-colors ${isOpen ? "bg-muted/30" : "hover:bg-muted/20"}`}>
              <td className="py-3 pl-4 align-top">
                <button
                  type="button"
                  onClick={() => setExpandedRow(isOpen ? null : o.id)}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Toggle order details"
                  aria-label="Toggle details"
                >
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>
              </td>
              <td className="py-3 pr-3 align-top">
                <button
                  type="button"
                  onClick={() => setExpandedRow(isOpen ? null : o.id)}
                  className="font-mono text-xs font-semibold hover:text-primary"
                >
                  {o.order_number}
                </button>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {" · "}
                  <span className="font-mono">{new Date(o.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                </div>
                {o.tracking_number ? (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-blue-400">
                    <Truck className="h-2.5 w-2.5" /> Tracked
                  </div>
                ) : null}
                {(() => {
                  const note = (o as { notes?: string | null }).notes;
                  if (!note) return null;
                  const noteOpen = !!expandedNotes[o.id];
                  const long = note.length > 120;
                  return (
                    <div className="mt-1.5 max-w-[280px] rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400">Customer note</span>
                      <div className={`mt-0.5 whitespace-pre-wrap ${!noteOpen && long ? "line-clamp-2" : ""}`}>{note}</div>
                      {long ? (
                        <button
                          type="button"
                          className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-amber-300 hover:text-amber-100"
                          onClick={() => setExpandedNotes((s) => ({ ...s, [o.id]: !s[o.id] }))}
                        >
                          {noteOpen ? "View less" : "View more"}
                        </button>
                      ) : null}
                    </div>
                  );
                })()}
              </td>
              <td className="py-3 pr-3 align-top">
                <div className="text-sm font-medium leading-tight">{customerName}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{o.contact_email}</div>
                {addr.phone ? <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">{displayPhone(addr.phone)}</div> : null}
              </td>
              <td className="py-3 pr-3 text-right align-top">
                <div className="font-mono text-sm font-bold">{formatPrice(o.total_cents)}</div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {o.payment_method === "cod" ? "COD" : "Online"}
                </div>
              </td>
              <td className="py-3 pr-3 align-top">
                <div className="flex flex-col items-start gap-1">
                  <StatusPill status={o.status} />
                  <PaymentPill status={o.payment_status ?? "pending"} />
                </div>
              </td>
              <td className="py-3 pr-3 align-top">
                <div className="flex flex-col gap-1.5">
                  <Select value={o.status} onValueChange={(status) => update.mutate({ id: o.id, status: status as "pending" | "paid" | "packed" | "shipped" | "delivered" | "cancelled" })}>
                    <SelectTrigger className="h-8 w-36 capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pending", "paid", "packed", "shipped", "delivered", "cancelled"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={o.payment_status ?? "pending"} onValueChange={(p) => updatePayment.mutate({ id: o.id, payment_status: p as "pending" | "paid" | "refunded" | "failed" })}>
                    <SelectTrigger className="h-8 w-36 capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pending", "paid", "refunded", "failed"].map((s) => <SelectItem key={s} value={s} className="capitalize">Pay · {s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </td>
              <td className="py-3 pr-4 text-right align-top">
                <div className="inline-flex items-center gap-1">
                  <Button variant="outline" size="sm" title={o.tracking_number ? "Edit tracking" : "Add tracking"} onClick={() => setTracking({ id: o.id, tracking_number: o.tracking_number ?? "", tracking_url: o.tracking_url ?? "" })}>
                    <Truck className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" title="Download PDF" onClick={async () => { const full = await fetchOrderFull(o.id); if (full) exportOrderPdf(full); }}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {archived ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Restore order ${o.order_number}?`,
                            description: "This moves the order back into the active Orders tab.",
                            confirmText: "Restore",
                          });
                          if (ok) restore.mutate({ id: o.id, order_number: o.order_number });
                        }}
                      >
                        Restore
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Permanently delete ${o.order_number}?`,
                            description: "The order and its items will be erased. A log entry will remain. This cannot be undone.",
                            confirmText: "Permanently delete",
                            destructive: true,
                          });
                          if (ok) permDelete.mutate({ id: o.id, order_number: o.order_number });
                        }}
                        title="Permanently delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Archive order ${o.order_number}?`,
                          description: "The order moves to the Archived tab. You can restore it or permanently delete it there.",
                          confirmText: "Archive",
                          destructive: true,
                        });
                        if (ok) archive.mutate({ id: o.id, order_number: o.order_number });
                      }}
                      title="Archive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
            {isOpen ? (
              <tr className="border-t border-border/60 bg-muted/10">
                <td colSpan={7} className="p-0">
                  <OrderDetailsPanel
                    orderId={o.id}
                    customerName={customerName}
                    onTracking={() => setTracking({ id: o.id, tracking_number: o.tracking_number ?? "", tracking_url: o.tracking_url ?? "" })}
                    onSaved={() => qc.invalidateQueries({ queryKey: ["admin-orders"] })}
                  />
                </td>
              </tr>
            ) : null}
            </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    <TrackingDialog value={tracking} onClose={() => setTracking(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); setTracking(null); }} />
    {confirmDialog}
    </>
  );
}


// ============ Expanded order details panel (admin only) ============
function OrderDetailsPanel({ orderId, customerName, onTracking, onSaved }: { orderId: string; customerName: string; onTracking: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-order-details", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [adminNote, setAdminNote] = useState("");
  useEffect(() => { setAdminNote((data as { admin_notes?: string | null } | null)?.admin_notes ?? ""); }, [data]);

  const saveNote = async () => {
    const { error } = await supabase.from("orders").update({ admin_notes: adminNote || null }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    await logAction("order.admin_note", "order", orderId);
    toast.success("Staff note saved");
    onSaved();
    refetch();
  };

  if (isLoading || !data) return <div className="p-6 text-sm text-muted-foreground">Loading order details…</div>;

  const addr = (data.shipping_address ?? {}) as Record<string, string>;
  const items = (data.order_items ?? []) as Array<{ id: string; product_name: string; product_series: string | null; product_image: string | null; quantity: number; unit_price_cents: number | null; line_total_cents: number }>;


  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr]">
      {/* Left column: header + timeline + items */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Order</div>
            <div className="font-mono text-lg font-bold">{data.order_number}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={async () => {
              const full = await supabase.from("orders").select("*, order_items(*)").eq("id", orderId).maybeSingle();
              if (full.data) exportOrderPdf(full.data as unknown as OrderPdf);
            }}><Download className="mr-1.5 h-3.5 w-3.5" />PDF</Button>
            <Button size="sm" variant="outline" onClick={async () => {
              const full = await supabase.from("orders").select("*, order_items(*)").eq("id", orderId).maybeSingle();
              if (full.data) downloadCsv(`order-${(full.data as { order_number: string }).order_number}.csv`, orderToCsvRows(full.data as unknown as OrderPdf));
            }}><Download className="mr-1.5 h-3.5 w-3.5" />CSV</Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-3.5 w-3.5" />Print</Button>
            <Button size="sm" variant="outline" onClick={onTracking}><Truck className="mr-1.5 h-3.5 w-3.5" />{data.tracking_number ? "Edit tracking" : "Add tracking"}</Button>
            {data.user_id ? (
              <Button size="sm" variant="outline" asChild>
                <Link to="/u/$id" params={{ id: data.user_id }}><UserIcon className="mr-1.5 h-3.5 w-3.5" />Customer</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl border border-border/60 bg-background/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Order Timeline</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {data.status === "cancelled"
                ? "Cancelled"
                : `Stage ${Math.max(1, ["pending","paid","packed","shipped","delivered"].indexOf(data.status) + 1)} of 5`}
            </div>
          </div>
          <OrderTimeline status={data.status} createdAt={data.created_at} orientation="horizontal" />
        </div>

        {/* Ordered products */}
        <div className="rounded-2xl border border-border/60 bg-background/40">
          <div className="border-b border-border/60 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Ordered products ({items.length})
          </div>
          <ul className="divide-y divide-border/60">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  {i.product_image ? <img src={i.product_image} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{i.product_name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{i.product_series ?? "—"} · Qty {i.quantity}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-mono text-muted-foreground">{formatPrice(i.unit_price_cents ?? Math.round(i.line_total_cents / Math.max(1, i.quantity)))}</div>
                  <div className="font-mono text-sm font-semibold">{formatPrice(i.line_total_cents)}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-border/60 px-4 py-3 text-xs">
            <Row label="Subtotal" value={formatPrice(data.subtotal_cents)} />
            {(data.discount_cents ?? 0) > 0 ? <Row label={`Discount${data.coupon_code ? ` (${data.coupon_code})` : ""}`} value={`− ${formatPrice(data.discount_cents ?? 0)}`} /> : null}
            <Row label="GST" value={formatPrice(data.tax_cents)} />
            <Row label="Shipping" value={data.shipping_cents === 0 ? "Free" : formatPrice(data.shipping_cents)} />
            <div className="flex items-center justify-between pt-2 text-sm font-semibold">
              <span>Total</span><span className="font-mono">{formatPrice(data.total_cents)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right column: meta */}
      <div className="space-y-4">
        <MetaCard title="Order info">
          <MetaRow k="Order ID" v={data.order_number} mono />
          <MetaRow k="Date & time" v={new Date(data.created_at).toLocaleString("en-IN")} />
          <MetaRow k="Order status" v={data.status} />
          <MetaRow k="Payment status" v={data.payment_status ?? "pending"} />
          <MetaRow k="Payment method" v={data.payment_method === "cod" ? "Cash on delivery" : "Online"} />
          {data.coupon_code ? <MetaRow k="Coupon" v={data.coupon_code} mono /> : null}
          {data.tracking_number ? <MetaRow k="Tracking" v={data.tracking_number} mono /> : null}
        </MetaCard>

        <MetaCard title="Customer">
          <div className="flex items-center gap-2 text-sm"><UserIcon className="h-3.5 w-3.5 text-muted-foreground" />{customerName}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5" />{data.contact_email ?? "—"}</div>
          <div className="mt-1 flex items-center gap-2 font-mono text-xs text-muted-foreground"><PhoneIcon className="h-3.5 w-3.5" />{displayPhone(addr.phone)}</div>
        </MetaCard>

        <MetaCard title="Shipping address">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="font-medium">{addr.full_name ?? "—"}</div>
              {addr.line1 ? <div>{addr.line1}</div> : null}
              {addr.line2 ? <div>{addr.line2}</div> : null}
              <div>{[addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")}</div>
              {addr.country ? <div>{addr.country}</div> : null}
            </div>
          </div>
        </MetaCard>

        {data.notes ? (
          <MetaCard title="Customer note" tone="amber">
            <p className="whitespace-pre-wrap text-sm">{data.notes}</p>
          </MetaCard>
        ) : null}

        <MetaCard title={<span className="flex items-center gap-1.5"><StickyNote className="h-3 w-3" /> Internal staff note</span>}>
          <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} placeholder="Only visible to staff…" className="text-sm" />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={saveNote}><Save className="mr-1.5 h-3.5 w-3.5" />Save note</Button>
          </div>
        </MetaCard>
      </div>
    </div>
  );
}

function MetaCard({ title, children, tone }: { title: React.ReactNode; children: React.ReactNode; tone?: "amber" }) {
  const cls = tone === "amber" ? "border-amber-500/40 bg-amber-500/5" : "border-border/60 bg-background/40";
  return (
    <div className={`rounded-2xl border ${cls} p-4`}>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function MetaRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className={mono ? "font-mono" : ""}>{v}</span>
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

function TrackingDialog({ value, onClose, onSaved }: { value: { id: string; tracking_number: string; tracking_url: string } | null; onClose: () => void; onSaved: () => void }) {
  const [tn, setTn] = useState("");
  const [tu, setTu] = useState("");
  useEffect(() => { setTn(value?.tracking_number ?? ""); setTu(value?.tracking_url ?? ""); }, [value]);
  async function save() {
    if (!value) return;
    const { error } = await supabase.from("orders").update({ tracking_number: tn || null, tracking_url: tu || null }).eq("id", value.id);
    if (error) return toast.error(error.message);
    await logAction("order.tracking_update", "order", value.id, { tracking_number: tn });
    toast.success("Tracking saved");
    onSaved();
  }
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Tracking info</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Tracking number</Label><Input value={tn} onChange={(e) => setTn(e.target.value)} placeholder="e.g. IN1234567890" /></div>
          <div><Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Tracking URL</Label><Input value={tu} onChange={(e) => setTu(e.target.value)} placeholder="https://…" /></div>
        </div>
        <div className="flex justify-end gap-2 pt-4"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// ============ Order Logs ============
type OrderLogRow = {
  id: string;
  created_at: string;
  order_id: string | null;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  previous_value: unknown;
  new_value: unknown;
  snapshot: unknown;
};

const ORDER_ACTIONS: { value: string; label: string }[] = [
  { value: "order.created", label: "Order Created" },
  { value: "order.status_changed", label: "Order Status Changed" },
  { value: "payment.status_changed", label: "Payment Status Changed" },
  { value: "tracking.added", label: "Tracking Added" },
  { value: "tracking.updated", label: "Tracking Updated" },
  { value: "tracking.removed", label: "Tracking Removed" },
  { value: "customer_note.updated", label: "Customer Note Updated" },
  { value: "staff_note.updated", label: "Staff Note Updated" },
  { value: "coupon.applied", label: "Coupon Applied" },
  { value: "coupon.removed", label: "Coupon Removed" },
  { value: "coupon.changed", label: "Coupon Changed" },
  { value: "order.archived", label: "Order Archived" },
  { value: "order.restored", label: "Order Restored" },
  { value: "order.permanently_deleted", label: "Order Permanently Deleted" },
];
const actionLabel = (a: string) => ORDER_ACTIONS.find((x) => x.value === a)?.label ?? a;

function OrderLogsAdmin() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["order-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as OrderLogRow[];
    },
  });

  const staffOptions = useMemo(() => {
    const s = new Map<string, string>();
    for (const l of logs ?? []) if (l.actor_email) s.set(l.actor_email, l.actor_name ?? l.actor_email);
    return Array.from(s.entries()).map(([email, name]) => ({ email, name }));
  }, [logs]);

  const filtered = useMemo(() => {
    let list = logs ?? [];
    if (actionFilter !== "all") list = list.filter((l) => l.action === actionFilter);
    if (staffFilter !== "all") list = list.filter((l) => l.actor_email === staffFilter);
    if (dateFrom) { const t = +new Date(dateFrom); list = list.filter((l) => +new Date(l.created_at) >= t); }
    if (dateTo) { const t = +new Date(dateTo) + 86400000; list = list.filter((l) => +new Date(l.created_at) < t); }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.order_number.toLowerCase().includes(q) ||
        (l.customer_name ?? "").toLowerCase().includes(q) ||
        (l.customer_email ?? "").toLowerCase().includes(q) ||
        (l.actor_email ?? "").toLowerCase().includes(q) ||
        (l.actor_name ?? "").toLowerCase().includes(q) ||
        actionLabel(l.action).toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, search, actionFilter, staffFilter, dateFrom, dateTo]);

  function exportCsv() {
    const t = (v: unknown) => { const s = v == null ? "" : String(v); return s ? `="${s.replace(/"/g, '""')}"` : ""; };
    downloadCsv(`order-logs-${new Date().toISOString().slice(0, 10)}.csv`, filtered.map((l) => ({
      "Timestamp": new Date(l.created_at).toLocaleString("en-IN"),
      "Order ID": t(l.order_number),
      "Customer": l.customer_name ?? "",
      "Customer Email": l.customer_email ?? "",
      "Action": actionLabel(l.action),
      "Staff User": l.actor_name ?? l.actor_email ?? "System",
      "Previous Value": l.previous_value ? JSON.stringify(l.previous_value) : "",
      "New Value": l.new_value ? JSON.stringify(l.new_value) : "",
    })));
  }

  async function exportPdf() {
    const jsPDFmod = await import("jspdf");
    const autoTableMod = await import("jspdf-autotable");
    const doc = new jsPDFmod.default({ unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("THE DIECAST VAULT", 40, 40);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
    doc.text("Order Logs", 40, 56);
    doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(`Order Logs (${filtered.length})`, 40, 90);
    doc.setDrawColor(200); doc.line(40, 108, 555, 108);
    autoTableMod.default(doc, {
      startY: 122,
      head: [["When", "Order", "Customer", "Action", "Staff"]],
      body: filtered.map((l) => [
        new Date(l.created_at).toLocaleString("en-IN"),
        l.order_number,
        l.customer_name ?? "—",
        actionLabel(l.action),
        l.actor_name ?? l.actor_email ?? "System",
      ]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [20, 20, 20], textColor: 255 },
    });
    doc.save(`order-logs-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Search order, customer, staff, action…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 max-w-xs" />
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ORDER_ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Staff" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All staff</SelectItem>
            {staffOptions.map((s) => <SelectItem key={s.email} value={s.email}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={filtered.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export PDF
          </Button>
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{filtered.length} / {logs?.length ?? 0} logs</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Action</th>
              <th className="p-3">Staff</th>
              <th className="p-3">Change</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-16 text-center text-sm text-muted-foreground">No log entries match your filters.</td></tr>
            ) : filtered.map((l) => (
              <Fragment key={l.id}>
                <tr className="border-t border-border/60">
                  <td className="p-3 align-top">
                    <button type="button" onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="inline-flex items-center gap-1 text-xs hover:text-primary">
                      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded === l.id ? "rotate-90" : ""}`} />
                      {new Date(l.created_at).toLocaleString("en-IN")}
                    </button>
                  </td>
                  <td className="p-3 align-top font-mono text-xs font-semibold">{l.order_number}</td>
                  <td className="p-3 align-top">
                    <div className="text-sm">{l.customer_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{l.customer_email ?? ""}</div>
                  </td>
                  <td className="p-3 align-top"><Badge variant="outline" className="text-[10px] uppercase tracking-wider">{actionLabel(l.action)}</Badge></td>
                  <td className="p-3 align-top">
                    <div className="text-sm">{l.actor_name ?? "System"}</div>
                    <div className="text-xs text-muted-foreground">{l.actor_email ?? ""}</div>
                  </td>
                  <td className="p-3 align-top text-xs text-muted-foreground">
                    {l.previous_value || l.new_value ? (
                      <div className="max-w-[280px]">
                        {l.previous_value ? <div><span className="text-muted-foreground/70">from:</span> <span className="font-mono">{JSON.stringify(l.previous_value)}</span></div> : null}
                        {l.new_value ? <div><span className="text-muted-foreground/70">to:</span> <span className="font-mono">{JSON.stringify(l.new_value)}</span></div> : null}
                      </div>
                    ) : "—"}
                  </td>
                </tr>
                {expanded === l.id ? (
                  <tr className="border-t border-border/60 bg-muted/20">
                    <td colSpan={6} className="p-0">
                      <OrderLogSnapshot log={l} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderLogSnapshot({ log }: { log: OrderLogRow }) {
  type Item = { product_name: string; product_series: string | null; product_image: string | null; quantity: number; unit_price_cents: number | null; line_total_cents: number };
  type OrderShape = {
    order_number?: string; created_at?: string; contact_email?: string; status?: string; payment_status?: string;
    payment_method?: string; coupon_code?: string | null; notes?: string | null; admin_notes?: string | null;
    tracking_number?: string | null; subtotal_cents?: number | null; discount_cents?: number | null;
    tax_cents?: number | null; shipping_cents?: number | null; total_cents?: number;
    shipping_address?: Record<string, string> | null;
  };
  const snap = (log.snapshot ?? {}) as { order?: OrderShape; items?: Item[] };
  const o: OrderShape = snap.order ?? {};
  const items: Item[] = snap.items ?? [];
  const addr = (o.shipping_address ?? {}) as Record<string, string>;

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-background/40">
          <div className="border-b border-border/60 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Products ({items.length})
          </div>
          <ul className="divide-y divide-border/60">
            {items.map((i, idx) => (
              <li key={idx} className="flex items-center gap-3 p-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {i.product_image ? (
                    <img
                      src={i.product_image}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{i.product_name || "Unnamed product"}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{i.product_series ?? "—"} · Qty {i.quantity}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-mono text-muted-foreground">{formatPrice(i.unit_price_cents ?? Math.round(i.line_total_cents / Math.max(1, i.quantity)))}</div>
                  <div className="font-mono text-sm font-semibold">{formatPrice(i.line_total_cents)}</div>
                </div>
              </li>
            ))}
            {items.length === 0 ? (
              <li className="flex items-center gap-3 p-4 text-xs text-muted-foreground">
                <Package className="h-4 w-4" />
                No ordered items recorded for this action.
              </li>
            ) : null}
          </ul>
          <div className="space-y-1 border-t border-border/60 px-4 py-3 text-xs">
            <Row label="Subtotal" value={formatPrice(o.subtotal_cents ?? 0)} />
            {(o.discount_cents ?? 0) > 0 ? <Row label={`Discount${o.coupon_code ? ` (${o.coupon_code})` : ""}`} value={`− ${formatPrice(o.discount_cents ?? 0)}`} /> : null}
            <Row label="GST" value={formatPrice(o.tax_cents ?? 0)} />
            <Row label="Shipping" value={o.shipping_cents === 0 ? "Free" : formatPrice(o.shipping_cents ?? 0)} />
            <div className="flex items-center justify-between pt-2 text-sm font-semibold">
              <span>Total</span><span className="font-mono">{formatPrice(o.total_cents ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <MetaCard title="Order info">
          <MetaRow k="Order ID" v={o.order_number ?? log.order_number} mono />
          <MetaRow k="Placed" v={o.created_at ? new Date(o.created_at).toLocaleString("en-IN") : "—"} />
          <MetaRow k="Order status" v={o.status ?? "—"} />
          <MetaRow k="Payment status" v={o.payment_status ?? "—"} />
          <MetaRow k="Payment method" v={o.payment_method === "cod" ? "Cash on delivery" : o.payment_method === "online" ? "Online" : "—"} />
          {o.coupon_code ? <MetaRow k="Coupon" v={o.coupon_code} mono /> : null}
          {o.tracking_number ? <MetaRow k="Tracking" v={o.tracking_number} mono /> : null}
        </MetaCard>
        <MetaCard title="Customer">
          <div className="text-sm">{log.customer_name ?? addr.full_name ?? "—"}</div>
          <div className="mt-1 text-xs text-muted-foreground">{log.customer_email ?? o.contact_email ?? ""}</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{displayPhone(addr.phone)}</div>
        </MetaCard>
        <MetaCard title="Shipping address">
          <div className="text-sm">
            <div className="font-medium">{addr.full_name ?? "—"}</div>
            {addr.line1 ? <div>{addr.line1}</div> : null}
            {addr.line2 ? <div>{addr.line2}</div> : null}
            <div>{[addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")}</div>
            {addr.country ? <div>{addr.country}</div> : null}
          </div>
        </MetaCard>
        {o.notes ? (
          <MetaCard title="Customer note" tone="amber"><p className="whitespace-pre-wrap text-sm">{o.notes}</p></MetaCard>
        ) : null}
        {o.admin_notes ? (
          <MetaCard title="Staff note"><p className="whitespace-pre-wrap text-sm">{o.admin_notes}</p></MetaCard>
        ) : null}
        <MetaCard title="Action">
          <MetaRow k="Type" v={actionLabel(log.action)} />
          <MetaRow k="Staff" v={log.actor_name ?? log.actor_email ?? "System"} />
          <MetaRow k="When" v={new Date(log.created_at).toLocaleString("en-IN")} />
          {log.previous_value ? <div className="mt-2"><div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Previous</div><pre className="mt-1 whitespace-pre-wrap break-all rounded bg-muted/40 p-2 text-[11px]">{JSON.stringify(log.previous_value, null, 2)}</pre></div> : null}
          {log.new_value ? <div className="mt-2"><div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">New</div><pre className="mt-1 whitespace-pre-wrap break-all rounded bg-muted/40 p-2 text-[11px]">{JSON.stringify(log.new_value, null, 2)}</pre></div> : null}
        </MetaCard>
      </div>
    </div>
  );
}

// ============ Reviews moderation ============

function ReviewsAdmin() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const { data: reviews } = useQuery({
    queryKey: ["admin-reviews", filter],
    queryFn: async () => {
      let q = supabase.from("reviews").select("*, products(name, slug)").order("created_at", { ascending: false });
      if (filter === "pending") q = q.eq("approved", false);
      if (filter === "approved") q = q.eq("approved", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const moderate = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from("reviews").update({ approved }).eq("id", id);
      if (error) throw error;
      await logAction(approved ? "review.approve" : "review.reject", "review", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
      await logAction("review.delete", "review", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });
  const wipeAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reviews").delete().not("id", "is", null);
      if (error) throw error;
      await logAction("review.wipe_all", "review", "*");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(["pending", "approved", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest ${filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border/70 text-muted-foreground"}`}>{f}</button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/60 text-destructive hover:bg-destructive/10"
          disabled={wipeAll.isPending || (reviews ?? []).length === 0}
          onClick={async () => {
            const ok = await confirm({
              title: "Delete ALL reviews?",
              description: "This removes every review across every car and cannot be undone.",
              confirmText: "Delete all",
              destructive: true,
            });
            if (ok) wipeAll.mutate();
          }}
        >
          {wipeAll.isPending ? "Deleting…" : "Delete all reviews"}
        </Button>
      </div>
      <div className="space-y-3">
        {(reviews ?? []).length === 0 ? <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">No reviews here.</div> : null}
        {(reviews ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border border-border/70 bg-card/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />)}</div>
                  <Link to="/shop/$slug" params={{ slug: (r as any).products?.slug ?? "" }} className="text-xs font-semibold hover:underline">{(r as any).products?.name}</Link>
                  {r.approved ? <Badge variant="outline" className="text-[10px]">Approved</Badge> : <Badge className="bg-accent text-[10px]">Pending</Badge>}
                </div>
                {r.title ? <div className="mt-1.5 text-sm font-semibold">{r.title}</div> : null}
                {r.body ? <p className="mt-1 text-sm text-muted-foreground">{r.body}</p> : null}
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">{new Date(r.created_at).toLocaleString("en-IN")}</div>
              </div>
              <div className="flex flex-col gap-2">
                {!r.approved ? <Button size="sm" onClick={() => moderate.mutate({ id: r.id, approved: true })}>Approve</Button> : <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: r.id, approved: false })}>Unapprove</Button>}
                <Button size="sm" variant="outline" onClick={() => del.mutate(r.id)}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {confirmDialog}
    </div>
  );
}

// ============ Customers ============
function CustomersAdmin() {
  const { data: customers } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_customers");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyBuyers, setOnlyBuyers] = useState(false);
  const filtered = (customers ?? []).filter((c: any) => {
    if (onlyBuyers && (c.order_count ?? 0) === 0) return false;
    if (search) {
      const q = search.toLowerCase();
      const qDigits = q.replace(/\D+/g, "");
      const phoneDigits = (c.phone ?? "").replace(/\D+/g, "");
      const matches =
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.display_name ?? "").toLowerCase().includes(q) ||
        (qDigits.length >= 3 && phoneDigits.includes(qDigits));
      if (!matches) return false;
    }
    return true;
  });
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Search name, email or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 max-w-xs" />
        <Select value={onlyBuyers ? "buyers" : "all"} onValueChange={(v) => setOnlyBuyers(v === "buyers")}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            <SelectItem value="buyers">Only buyers</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{filtered.length} / {(customers ?? []).length}</div>
      </div>
    <div className="overflow-hidden rounded-2xl border border-border/70">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <tr><th className="p-3 w-8"></th><th className="p-3">Customer</th><th className="p-3">Phone</th><th className="p-3">Orders</th><th className="p-3">Lifetime spend</th><th className="p-3">Last order</th></tr>
        </thead>
        <tbody>
          {filtered.map((c: any) => (
            <Fragment key={c.user_id}>
              <tr
                className="cursor-pointer border-t border-border/60 hover:bg-muted/30"
                onClick={() => setExpanded(expanded === c.user_id ? null : c.user_id)}
              >
                <td className="p-3 text-muted-foreground">
                  <ChevronRight className={`h-4 w-4 transition-transform ${expanded === c.user_id ? "rotate-90" : ""}`} />
                </td>
                <td className="p-3">
                  <div className="font-semibold">{c.display_name ?? c.email?.split("@")[0]}</div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </td>
                <td className="p-3 font-mono text-xs">{displayPhone(c.phone)}</td>
                <td className="p-3 font-mono">{c.order_count}</td>
                <td className="p-3 font-mono">{formatPrice(c.total_spent_cents)}</td>
                <td className="p-3 text-muted-foreground">{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("en-IN") : "—"}</td>
              </tr>
              {expanded === c.user_id ? (
                <tr className="border-t border-border/60 bg-muted/20">
                  <td colSpan={6} className="p-4">
                    <CustomerOrdersPanel userId={c.user_id} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function CustomerOrdersPanel({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-customer-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_cents, created_at, order_items(id, product_name, product_series, quantity, line_total_cents, product_image)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <div className="text-xs text-muted-foreground">Loading orders…</div>;
  if (!data || data.length === 0) return <div className="text-xs text-muted-foreground">No orders yet.</div>;
  return (
    <div className="space-y-3">
      {data.map((o) => (
        <div key={o.id} className="rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link to="/orders/$id" params={{ id: o.id }} className="font-mono text-xs font-semibold hover:underline">{o.order_number}</Link>
              <span className="ml-2 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill status={o.status} />
              <span className="font-mono text-sm font-bold">{formatPrice(o.total_cents)}</span>
            </div>
          </div>
          <ul className="mt-3 divide-y divide-border/50">
            {(o.order_items ?? []).map((i: any) => (
              <li key={i.id} className="flex items-center gap-3 py-2">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                  {i.product_image ? <img src={i.product_image} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{i.product_name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{i.product_series} · x{i.quantity}</div>
                </div>
                <div className="font-mono text-xs">{formatPrice(i.line_total_cents)}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ============ Coupons ============
function CouponsAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const { data: coupons } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from("coupons").update({ active }).eq("id", id);
      await logAction("coupon.toggle", "coupon", id, { active });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
  const del = useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
      await logAction("coupon.delete", "coupon", id, { code });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-coupons"] }); toast.success("Coupon deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{coupons?.length ?? 0} coupons</div>
        <Button onClick={() => setOpen(true)} className="rounded-full"><Plus className="mr-2 h-4 w-4" />New coupon</Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Discount</th>
              <th className="p-3">Min order</th>
              <th className="p-3">Per person</th>
              <th className="p-3">First X</th>
              <th className="p-3">Used</th>
              <th className="p-3">Valid</th>
              <th className="p-3">Active</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(coupons ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border/60">
                <td className="p-3">
                  <div className="font-mono font-bold">{c.code}</div>
                  {c.description ? <div className="text-xs text-muted-foreground">{c.description}</div> : null}
                </td>
                <td className="p-3 font-mono">
                  {c.discount_type === "percent" ? `${c.discount_value}%` : formatPrice(c.discount_value)}
                  {c.max_discount_cents ? <div className="text-[10px] text-muted-foreground">max {formatPrice(c.max_discount_cents)}</div> : null}
                </td>
                <td className="p-3 font-mono">{formatPrice(c.min_order_cents)}</td>
                <td className="p-3 font-mono">{c.max_uses_per_person ?? "∞"}</td>
                <td className="p-3 font-mono">{c.first_x_customers ?? "—"}</td>
                <td className="p-3 font-mono">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {c.valid_from ? <div>from {new Date(c.valid_from).toLocaleDateString("en-IN")}</div> : null}
                  {c.expires_at ? <div>to {new Date(c.expires_at).toLocaleDateString("en-IN")}</div> : (!c.valid_from ? "—" : null)}
                </td>
                <td className="p-3"><Switch checked={c.active} onCheckedChange={(v) => toggle.mutate({ id: c.id, active: v })} /></td>
                <td className="p-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Delete coupon ${c.code}?`,
                        description: "Customers will no longer be able to redeem this code.",
                        confirmText: "Delete",
                        destructive: true,
                      });
                      if (ok) del.mutate({ id: c.id, code: c.code });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CouponDialog open={open} onOpenChange={setOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-coupons"] })} />
      {confirmDialog}
    </div>
  );
}

function CouponDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState(10);
  const [minOrder, setMinOrder] = useState(0);
  const [maxDiscount, setMaxDiscount] = useState<number | "">("");
  const [maxUses, setMaxUses] = useState<number | "">("");
  const [maxUsesPerPerson, setMaxUsesPerPerson] = useState<number | "">("");
  const [firstXCustomers, setFirstXCustomers] = useState<number | "">("");
  const [validFrom, setValidFrom] = useState("");
  const [expires, setExpires] = useState("");
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (open) {
      setCode(""); setDescription(""); setType("percent"); setValue(10); setMinOrder(0);
      setMaxDiscount(""); setMaxUses(""); setMaxUsesPerPerson(""); setFirstXCustomers("");
      setValidFrom(""); setExpires(""); setActive(true);
    }
  }, [open]);
  async function save() {
    if (!code.trim()) return toast.error("Please enter a coupon code");
    if (value <= 0) return toast.error("Discount value must be greater than 0");
    if (type === "percent" && value > 100) return toast.error("Percent discount can't be more than 100%");
    const { error } = await supabase.from("coupons").insert({
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      discount_type: type,
      discount_value: type === "fixed" ? Math.round(value * 100) : value,
      min_order_cents: Math.round(minOrder * 100),
      max_discount_cents: maxDiscount === "" ? null : Math.round(Number(maxDiscount) * 100),
      max_uses: maxUses === "" ? null : Number(maxUses),
      max_uses_per_person: maxUsesPerPerson === "" ? null : Number(maxUsesPerPerson),
      first_x_customers: firstXCustomers === "" ? null : Number(firstXCustomers),
      valid_from: validFrom ? new Date(validFrom).toISOString() : null,
      expires_at: expires ? new Date(expires).toISOString() : null,
      active,
    });
    if (error) return toast.error(error.message);
    await logAction("coupon.create", "coupon", null, { code: code.trim().toUpperCase() });
    toast.success("Coupon created");
    onSaved(); onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>New coupon</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="mb-1.5 block text-xs">Code *</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" /></div>
          <div>
            <Label className="mb-1.5 block text-xs">Discount type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "percent" | "fixed")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="percent">Percentage %</SelectItem><SelectItem value="fixed">Fixed ₹</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label className="mb-1.5 block text-xs">Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Welcome offer for new collectors" /></div>
          <div><Label className="mb-1.5 block text-xs">Discount value {type === "fixed" ? "(₹)" : "(%)"} *</Label><Input type="number" min={1} step="0.01" value={value} onChange={(e) => setValue(Number(e.target.value))} /></div>
          <div><Label className="mb-1.5 block text-xs">Max discount amount (₹)</Label><Input type="number" min={0} step="0.01" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value ? Number(e.target.value) : "")} placeholder="Cap for % discounts" /></div>
          <div><Label className="mb-1.5 block text-xs">Minimum order value (₹)</Label><Input type="number" min={0} step="0.01" value={minOrder} onChange={(e) => setMinOrder(Number(e.target.value))} /></div>
          <div><Label className="mb-1.5 block text-xs">Maximum total uses</Label><Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : "")} placeholder="Blank = unlimited" /></div>
          <div><Label className="mb-1.5 block text-xs">Maximum uses per person</Label><Input type="number" min={1} value={maxUsesPerPerson} onChange={(e) => setMaxUsesPerPerson(e.target.value ? Number(e.target.value) : "")} placeholder="Blank = unlimited" /></div>
          <div><Label className="mb-1.5 block text-xs">First X customers</Label><Input type="number" min={1} value={firstXCustomers} onChange={(e) => setFirstXCustomers(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 10" /></div>
          <div><Label className="mb-1.5 block text-xs">Valid from</Label><Input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></div>
          <div><Label className="mb-1.5 block text-xs">Expiry date</Label><Input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
          <div className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-border/60 p-3">
            <Switch checked={active} onCheckedChange={setActive} />
            <div className="text-sm"><div className="font-semibold">Active</div><div className="text-xs text-muted-foreground">Customers can redeem this coupon at checkout.</div></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save}>Create coupon</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// ============ Analytics ============
function AnalyticsAdmin() {
  const { data } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [{ data: orders }, { data: items }] = await Promise.all([
        supabase.from("orders").select("total_cents, created_at").gte("created_at", since),
        supabase.from("order_items").select("product_name, quantity, line_total_cents"),
      ]);
      return { orders: orders ?? [], items: items ?? [] };
    },
  });
  const chart = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const o of data?.orders ?? []) {
      const key = o.created_at.slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + o.total_cents);
    }
    const arr = Array.from(map.entries()).map(([date, cents]) => ({ date, cents }));
    const max = Math.max(1, ...arr.map((a) => a.cents));
    return { arr, max };
  }, [data?.orders]);
  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const it of data?.items ?? []) {
      const cur = map.get(it.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += it.line_total_cents;
      map.set(it.product_name, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);
  }, [data?.items]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Revenue · last 30 days</div>
        <div className="mt-2 font-mono text-3xl font-bold">{formatPrice(chart.arr.reduce((s, d) => s + d.cents, 0))}</div>
        <div className="mt-6 flex h-40 items-end gap-1">
          {chart.arr.map((d) => (
            <div key={d.date} className="group relative flex-1" title={`${d.date}: ${formatPrice(d.cents)}`}>
              <div className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary" style={{ height: `${(d.cents / chart.max) * 100}%`, minHeight: d.cents > 0 ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          <span>{chart.arr[0]?.date.slice(5)}</span><span>{chart.arr[chart.arr.length - 1]?.date.slice(5)}</span>
        </div>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Top sellers · all time</div>
        <ul className="mt-4 space-y-2">
          {topProducts.map(([name, s]) => (
            <li key={name} className="flex items-center justify-between text-sm">
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <span className="ml-3 font-mono text-xs text-muted-foreground">×{s.qty}</span>
              <span className="ml-3 font-mono">{formatPrice(s.revenue)}</span>
            </li>
          ))}
          {topProducts.length === 0 ? <div className="text-sm text-muted-foreground">No sales yet.</div> : null}
        </ul>
      </div>
    </div>
  );
}

// ============ Audit log ============
function AuditAdmin() {
  const { data: log } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const actions = Array.from(new Set((log ?? []).map((l) => l.action))).sort();
  const filtered = (log ?? []).filter((l) => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${l.actor_email ?? ""} ${l.action} ${l.entity_type ?? ""} ${l.entity_id ?? ""} ${l.metadata ? JSON.stringify(l.metadata) : ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Search actor, target, details…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 max-w-xs" />
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCsv(`audit-${new Date().toISOString().slice(0,10)}.csv`, filtered.map((l) => ({
            when: new Date(l.created_at).toLocaleString("en-IN"),
            actor: l.actor_email ?? l.actor_id ?? "",
            action: l.action,
            entity_type: l.entity_type ?? "",
            entity_id: l.entity_id ?? "",
            details: l.metadata ? JSON.stringify(l.metadata) : "",
          })))}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportAuditLogsPdf(filtered.map((l) => ({
            created_at: l.created_at,
            actor_email: l.actor_email ?? null,
            action: l.action,
            entity_type: l.entity_type ?? null,
            entity_id: l.entity_id ?? null,
            metadata: l.metadata,
          })))}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
          </Button>
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{filtered.length} / {(log ?? []).length}</div>
        </div>
      </div>
    <div className="overflow-hidden rounded-2xl border border-border/70">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Details</th></tr>
        </thead>
        <tbody>
          {filtered.map((l) => (
            <tr key={l.id} className="border-t border-border/60">
              <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("en-IN")}</td>
              <td className="p-3 text-xs">{l.actor_email ?? l.actor_id?.slice(0, 8)}</td>
              <td className="p-3"><Badge variant="outline" className="text-[10px]">{l.action}</Badge></td>
              <td className="p-3 font-mono text-xs">{l.entity_type}{l.entity_id ? `#${l.entity_id.slice(0, 6)}` : ""}</td>
              <td className="p-3 font-mono text-[10px] text-muted-foreground">{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
            </tr>
          ))}
          {filtered.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">No matching entries.</td></tr> : null}
        </tbody>
      </table>
    </div>
    </div>
  );
}

// ============ Roles ============
type GrantRole = "staff" | "admin";

function RolesAdmin() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();

  const { data: customers } = useQuery({
    queryKey: ["admin-customers-roles"],
    queryFn: async () => {
      const [{ data: cust }, { data: roles }] = await Promise.all([
        supabase.rpc("admin_list_customers"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      }
      return (cust ?? []).map((c: any) => ({ ...c, roles: roleMap.get(c.user_id) ?? [] }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ user_id, role, grant }: { user_id: string; role: GrantRole; grant: boolean }) => {
      const { error } = await supabase.rpc("admin_set_role", { _target_user: user_id, _role: role, _grant: grant });
      if (error) throw error;
      await logAction(grant ? "role.grant" : "role.revoke", "user", user_id, { role });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customers-roles"] }); toast.success("Role updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Box 1: grant role by email
  const [email, setEmail] = useState("");
  const [grantRole, setGrantRole] = useState<GrantRole>("staff");
  const grantByEmail = useMutation({
    mutationFn: async () => {
      const trimmed = email.trim();
      if (!trimmed) throw new Error("Enter an email address");
      const { data, error } = await supabase.rpc("admin_grant_role_by_email", {
        _email: trimmed,
        _role: grantRole,
        _grant: true,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.user_id) await logAction("role.grant", "user", row.user_id, { role: grantRole, via: "email" });
      return trimmed;
    },
    onSuccess: (mail) => {
      qc.invalidateQueries({ queryKey: ["admin-customers-roles"] });
      toast.success(`Granted ${grantRole} to ${mail}`);
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const admins = (customers ?? []).filter((c) => c.roles.includes("admin"));
  const staff = (customers ?? []).filter((c) => c.roles.includes("staff") && !c.roles.includes("admin"));

  const RoleList = ({
    title,
    tag,
    role,
    rows,
    empty,
    accent,
  }: {
    title: string;
    tag: string;
    role: GrantRole;
    rows: typeof admins;
    empty: string;
    accent: string;
  }) => (
    <div className="overflow-hidden rounded-2xl border border-border/70">
      <div className="border-b border-border/60 bg-muted/30 p-4">
        <div className={`font-mono text-[10px] uppercase tracking-[0.22em] ${accent}`}>{tag}</div>
        <h3 className="mt-1 text-lg font-bold">{title} <span className="text-muted-foreground font-mono text-xs">({rows.length})</span></h3>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">{empty}</div>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((c) => (
            <li key={c.user_id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{c.display_name ?? c.email?.split("@")[0]}</div>
                <div className="truncate text-xs text-muted-foreground">{c.email}</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-destructive hover:bg-destructive/10"
                disabled={setRole.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Remove ${role} access?`,
                    description: `${c.email} will lose ${role} privileges and go back to customer access.`,
                    confirmText: "Remove",
                    destructive: true,
                  });
                  if (ok) setRole.mutate({ user_id: c.user_id, role, grant: false });
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      {/* Box 1 — grant by email */}
      <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Grant access</div>
        <h3 className="mt-1 text-lg font-bold">Add staff or admin by email</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          The person must already have an account and a confirmed email.
        </p>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => { e.preventDefault(); grantByEmail.mutate(); }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="grant-email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
            <Input
              id="grant-email"
              type="email"
              placeholder="person@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
            <Select value={grantRole} onValueChange={(v) => setGrantRole(v as GrantRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff — dashboard + add products, no deletes</SelectItem>
                <SelectItem value="admin">Admin — full access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={grantByEmail.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            {grantByEmail.isPending ? "Granting…" : "Grant access"}
          </Button>
        </form>

        <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <div className="mb-1 font-mono uppercase tracking-[0.2em] text-foreground/70">Role scope</div>
          <div><span className="font-semibold text-foreground">Customer</span> — shop & buy only (default).</div>
          <div><span className="font-semibold text-foreground">Staff</span> — dashboard, analytics, orders, add & edit products.</div>
          <div><span className="font-semibold text-foreground">Admin</span> — everything: delete, change orders, manage users & coupons.</div>
        </div>
      </div>

      {/* Box 2 — Admins & Staff, separate */}
      <div className="space-y-6">
        <RoleList
          title="Admins"
          tag="Full access"
          role="admin"
          rows={admins}
          empty="No admins yet."
          accent="text-foreground/70"
        />
        <RoleList
          title="Staff"
          tag="Dashboard access"
          role="staff"
          rows={staff}
          empty="No staff yet."
          accent="text-muted-foreground"
        />
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mr-2 inline h-3 w-3" /> Only admins can change roles. Removing a role sends the user back to customer access.
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

// ---------- Settings admin ----------
function SettingsAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["site_settings_admin"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      const map: Record<string, unknown> = {};
      for (const r of data ?? []) map[r.key] = r.value;
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async (rows: { key: string; value: unknown }[]) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert(rows.map((r) => ({ key: r.key, value: r.value as never })), { onConflict: "key" });
      if (error) throw error;
      for (const r of rows) {
        await logAction("update", "site_settings", r.key, { value: r.value });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site_settings_admin"] });
      qc.invalidateQueries({ queryKey: ["site_settings"] });
      toast.success("Settings saved");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  function get<K extends SettingKey>(key: K): (typeof SETTINGS_DEFAULTS)[K] {
    const raw = data?.[key];
    const def = SETTINGS_DEFAULTS[key];
    if (raw == null) return def;
    if (typeof def === "boolean") return (raw === true) as (typeof SETTINGS_DEFAULTS)[K];
    if (typeof def === "number") {
      const n = typeof raw === "number" ? raw : Number(raw);
      return (Number.isFinite(n) ? n : def) as (typeof SETTINGS_DEFAULTS)[K];
    }
    return (typeof raw === "string" ? raw : String(raw)) as (typeof SETTINGS_DEFAULTS)[K];
  }

  function getBlob<T extends Record<string, unknown>>(key: string, defaults: T): T {
    const raw = data?.[key];
    if (!raw || typeof raw !== "object") return defaults;
    return { ...defaults, ...(raw as Partial<T>) } as T;
  }

  const setOne = (key: string, value: unknown) => save.mutate([{ key, value }]);
  const busy = isLoading || save.isPending;

  const general = getBlob<GeneralConfig>("general", GENERAL_DEFAULTS);
  const hero = getBlob<HomepageHeroConfig>("homepage_hero", HERO_DEFAULTS);
  const sections = getBlob<HomepageSectionsConfig>("homepage_sections", SECTIONS_DEFAULTS);
  const shop = getBlob<ShopConfig>("shop_config", SHOP_DEFAULTS);
  const inventory = getBlob<InventoryConfig>("inventory_config", INVENTORY_DEFAULTS);
  const social = getBlob<SocialLinks>("social_links", SOCIAL_DEFAULTS);
  const footer = getBlob<FooterConfig>("footer_config", FOOTER_DEFAULTS);
  const notifs = getBlob<NotificationPrefs>("notification_prefs", NOTIF_DEFAULTS);

  return (
    <div className="mx-auto max-w-5xl">
      <Tabs defaultValue="general" className="w-full">
        <div className="mb-6 rounded-2xl border border-border/70 bg-card/40 p-1.5">
          <TabsList className="flex h-auto w-full flex-wrap gap-1 bg-transparent p-0">
            {[
              { v: "general",       label: "General",       Icon: SettingsIcon },
              { v: "homepage",      label: "Homepage",      Icon: Radio },
              { v: "content",       label: "Content",       Icon: FileText },
              { v: "shop",          label: "Shop",          Icon: ShoppingBag },
              { v: "inventory",     label: "Inventory",     Icon: Package },
              { v: "social",        label: "Social",        Icon: Users },
              { v: "footer",        label: "Footer",        Icon: StickyNote },
              { v: "announcements", label: "Announcements", Icon: Megaphone },
              { v: "notifications", label: "Notifications", Icon: Radio },
              { v: "master",        label: "Final Reset",   Icon: Trash2 },
            ].map(({ v, label, Icon }) => (
              <TabsTrigger
                key={v}
                value={v}
                className="group flex-1 min-w-[110px] gap-1.5 rounded-xl px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* GENERAL */}
        <TabsContent value="general" className="mt-4 space-y-6">
          <SettingsSection title="Website identity" description="Basic branding and contact information for the site.">
            <BlobEditor
              defaults={GENERAL_DEFAULTS}
              value={general}
              busy={busy}
              onSave={(v) => setOne("general", v)}
              fields={[
                { key: "site_name", label: "Website name" },
                { key: "logo_url", label: "Logo URL" },
                { key: "favicon_url", label: "Favicon URL" },
                { key: "support_email", label: "Support email", type: "email" },
                { key: "support_phone", label: "Support phone" },
                { key: "business_address", label: "Business address", multiline: true },
                { key: "footer_copyright", label: "Footer copyright" },
                { key: "footer_description", label: "Footer description", multiline: true },
              ]}
            />
          </SettingsSection>
          <SettingsSection title="Site status" description="Temporarily disable the storefront for customers. Staff and admins can still browse.">
            <BlobEditor
              defaults={GENERAL_DEFAULTS}
              value={general}
              busy={busy}
              onSave={(v) => setOne("general", v)}
              fields={[
                { key: "maintenance_mode", label: "Enable maintenance mode", type: "boolean", hint: "Visitors see a maintenance notice. Staff and admins bypass automatically." },
                { key: "maintenance_message", label: "Maintenance message", multiline: true, hint: "Shown to visitors while maintenance mode is on." },
              ]}
            />
            <ToggleRow label="Enable coming soon mode" checked={get("coming_soon_mode")} disabled={busy}
              onChange={(v) => setOne("coming_soon_mode", v)} />
            <p className="text-[11px] text-muted-foreground">Coming soon mode hides prices and the Add to cart button across the shop.</p>
          </SettingsSection>
        </TabsContent>

        {/* HOMEPAGE HERO */}
        <TabsContent value="homepage" className="mt-4 space-y-6">
          <HomepageSettings
            hero={hero}
            busy={busy}
            onSaveHero={(v) => setOne("homepage_hero", v)}
            legacy={{
              line1: get("hero_line1"),
              prefix: get("hero_line2_prefix"),
              italic: get("hero_line2_italic"),
              suffix: get("hero_line2_suffix"),
              onSave: (k, v) => setOne(k, v),
            }}
          />
        </TabsContent>

        {/* HOMEPAGE SECTIONS / CONTENT */}
        <TabsContent value="content" className="mt-4 space-y-6">
          <SettingsSection title="Homepage sections" description="Show or hide sections on the homepage.">
            <BlobEditor
              defaults={SECTIONS_DEFAULTS}
              value={sections}
              busy={busy}
              onSave={(v) => setOne("homepage_sections", v)}
              fields={[
                { key: "show_featured", label: "Show Featured / New Arrivals", type: "boolean" },
                { key: "show_collections", label: "Show Featured Collections", type: "boolean" },
                { key: "show_new_drops", label: "Show New Drops", type: "boolean" },
                { key: "show_accessories", label: "Show Accessories", type: "boolean" },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Tip: to feature a specific product, mark it "featured" on the product page — those show automatically.
            </p>
          </SettingsSection>
        </TabsContent>

        {/* SHOP */}
        <TabsContent value="shop" className="mt-4 space-y-6">
          <SettingsSection title="Currency" description="How prices display across the storefront.">
            <BlobEditor
              defaults={SHOP_DEFAULTS}
              value={shop}
              busy={busy}
              onSave={(v) => setOne("shop_config", v)}
              fields={[
                { key: "currency", label: "Currency code (INR, USD, …)" },
                { key: "currency_symbol", label: "Currency symbol" },
              ]}
            />
          </SettingsSection>
          <SettingsSection title="Shipping & tax" description="Charges applied at checkout. Enter all amounts in rupees (₹).">
            <RupeeRow
              label="Shipping cost"
              hint="Set to 0 for free shipping on every order."
              cents={shop.shipping_cents}
              disabled={busy}
              onSave={(cents) => setOne("shop_config", { ...shop, shipping_cents: cents })}
            />
            <RupeeRow
              label="Free shipping threshold"
              hint="Orders at or above this amount ship free."
              cents={shop.free_ship_threshold_cents}
              disabled={busy}
              onSave={(cents) => setOne("shop_config", { ...shop, free_ship_threshold_cents: cents })}
            />
            <BlobEditor
              defaults={SHOP_DEFAULTS}
              value={shop}
              busy={busy}
              onSave={(v) => setOne("shop_config", v)}
              fields={[
                { key: "estimated_delivery_days", label: "Estimated delivery days" },
                { key: "tax_percent", label: "Tax / GST percent", type: "number" },
              ]}
            />
          </SettingsSection>
          <SettingsSection title="Payment" description="Which payment methods customers can use.">
            <BlobEditor
              defaults={SHOP_DEFAULTS}
              value={shop}
              busy={busy}
              onSave={(v) => setOne("shop_config", v)}
              fields={[
                { key: "cod_enabled", label: "Cash on delivery enabled", type: "boolean" },
              ]}
            />
          </SettingsSection>
        </TabsContent>

        {/* INVENTORY */}
        <TabsContent value="inventory" className="mt-4 space-y-6">
          <SettingsSection title="Inventory settings" description="Defaults and shop-wide inventory behavior.">
            <BlobEditor
              defaults={INVENTORY_DEFAULTS}
              value={inventory}
              busy={busy}
              onSave={(v) => setOne("inventory_config", v)}
              fields={[
                { key: "default_stock", label: "Default stock quantity", type: "number", hint: "Starting stock used when creating a new product." },
                { key: "low_stock_threshold", label: "Low stock threshold", type: "number", hint: "Products with stock at or below this number are flagged 'low stock'." },
                { key: "hide_out_of_stock", label: "Hide out-of-stock products", type: "boolean", hint: "Removes 0-stock products from shop listings and search entirely." },
                { key: "allow_backorders", label: "Allow backorders", type: "boolean", hint: "Let customers place orders even when a product has 0 stock." },
                { key: "auto_sold_out", label: "Auto-mark sold out when stock reaches 0", type: "boolean", hint: "Automatically switch the product badge to 'Sold Out' once stock hits zero." },
                { key: "auto_restore_stock", label: "Auto-restore stock on cancelled orders", type: "boolean", hint: "When an order is cancelled, return its items back into stock." },
              ]}
            />
          </SettingsSection>
          <SettingsSection title="Notification emails" description="Admin recipients for stock alerts.">
            <TextRow label="Admin alert email" placeholder="you@yourdomain.com" value={get("admin_alert_email")} disabled={busy}
              onSave={(v) => setOne("admin_alert_email", v.trim())} />
            <NumberRow label="Global low-stock alert threshold" value={get("low_stock_alert_threshold")} disabled={busy} min={0}
              onSave={(v) => setOne("low_stock_alert_threshold", v)} />
          </SettingsSection>
        </TabsContent>

        {/* SOCIAL */}
        <TabsContent value="social" className="mt-4 space-y-6">
          <SettingsSection title="Social media" description="Links appear in the footer.">
            <BlobEditor
              defaults={SOCIAL_DEFAULTS}
              value={social}
              busy={busy}
              onSave={(v) => setOne("social_links", v)}
              fields={[
                { key: "instagram", label: "Instagram URL" },
                { key: "facebook", label: "Facebook URL" },
                { key: "twitter", label: "X (Twitter) URL" },
                { key: "youtube", label: "YouTube URL" },
                { key: "discord", label: "Discord invite URL" },
                { key: "whatsapp", label: "WhatsApp number (with country code)" },
                { key: "email", label: "Contact email" },
              ]}
            />
          </SettingsSection>
        </TabsContent>

        {/* FOOTER */}
        <TabsContent value="footer" className="mt-4 space-y-6">
          <SettingsSection title="Footer link columns" description="Each list becomes a column in the site footer. Edit and save each column independently.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <FooterLinksEditor label="Quick Links" value={footer.quick_links} disabled={busy}
                  onSave={(v) => setOne("footer_config", { ...footer, quick_links: v })} />
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <FooterLinksEditor label="Shop Links" value={footer.shop_links} disabled={busy}
                  onSave={(v) => setOne("footer_config", { ...footer, shop_links: v })} />
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <FooterLinksEditor label="Company Links" value={footer.company_links} disabled={busy}
                  onSave={(v) => setOne("footer_config", { ...footer, company_links: v })} />
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <FooterLinksEditor label="Legal Links" value={footer.legal_links} disabled={busy}
                  onSave={(v) => setOne("footer_config", { ...footer, legal_links: v })} />
              </div>
            </div>
          </SettingsSection>
        </TabsContent>

        {/* ANNOUNCEMENTS */}
        <TabsContent value="announcements" className="mt-4 space-y-6">
          <AnnouncementsAdmin />
        </TabsContent>

        {/* NOTIFICATIONS */}
        <TabsContent value="notifications" className="mt-4 space-y-6">
          <NotificationsWorkspace
            prefs={notifs}
            busy={busy}
            onSavePrefs={(v) => setOne("notification_prefs", v)}
          />
        </TabsContent>

        {/* PREPARE FOR PRODUCTION */}
        <TabsContent value="master" className="mt-4 space-y-6">
          <PrepareForProductionAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Final Reset ----------
const PREP_SCOPES: { key: string; label: string }[] = [
  { key: "notifications", label: "Notifications" },
  { key: "carts", label: "Shopping carts" },
  { key: "wishlist", label: "Wishlists" },
  { key: "reviews", label: "Product reviews" },
  { key: "orders_all", label: "Orders (active + archived)" },
  { key: "order_logs", label: "Order logs" },
  { key: "auction_history", label: "Auction history" },
  { key: "auction_logs", label: "Auction logs" },
  { key: "coupon_usage", label: "Coupon usage" },
  { key: "badge_assignments", label: "Badge assignments" },
  { key: "activity_events", label: "Activity records" },
  { key: "test_customers", label: "Test customer accounts" },
];

const PREP_PRESERVE = [
  "Products & categories",
  "Inventory & product images",
  "Homepage content & branding",
  "Website settings & footer",
  "Coupons & badge definitions",
  "Staff, admin accounts & roles",
  "Uploaded assets & storage",
];

function PrepareForProductionAdmin() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [includeFlash, setIncludeFlash] = useState(false);
  const [includeNotifs, setIncludeNotifs] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ total: number; duration: number; counts: Record<string, number> } | null>(null);

  const { data: counts, refetch: refetchCounts } = useQuery({
    queryKey: ["prep-counts", includeFlash, includeNotifs],
    queryFn: async () => {
      const keys = [...PREP_SCOPES.map((s) => s.key)];
      if (includeFlash) keys.push("flash_announcements");
      if (includeNotifs) keys.push("notification_history");
      const results = await Promise.all(
        keys.map(async (key) => {
          const { data } = await supabase.rpc("admin_count_scope", { _scope: key });
          return [key, Number(data ?? 0)] as const;
        }),
      );
      return Object.fromEntries(results) as Record<string, number>;
    },
    refetchOnWindowFocus: true,
  });

  const grandTotal = useMemo(() => {
    if (!counts) return 0;
    return Object.values(counts).reduce((a, b) => a + b, 0);
  }, [counts]);

  const removeList = useMemo(() => {
    const list = PREP_SCOPES.map((s) => ({ label: s.label, count: counts?.[s.key] ?? 0 }));
    if (includeFlash) list.push({ label: "Flash announcement banner", count: counts?.flash_announcements ?? 0 });
    if (includeNotifs) list.push({ label: "Notification history", count: counts?.notification_history ?? 0 });
    return list;
  }, [counts, includeFlash, includeNotifs]);

  const canPrepare = confirmText.trim().toUpperCase() === "RESET" && !busy && grandTotal > 0;

  async function runPrepare() {
    const ok = await confirm({
      title: "Run Final Reset?",
      description: `This will permanently remove approximately ${grandTotal.toLocaleString("en-IN")} test / development records. Products, staff accounts, branding and settings will be kept. This cannot be undone.`,
      confirmText: "Run Final Reset",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.rpc("admin_prepare_production", {
        _include_flash: includeFlash,
        _include_notifications: includeNotifs,
      });
      if (error) throw error;
      const payload = data as { total_rows?: number; duration_ms?: number; counts?: Record<string, number> } | null;
      const total = payload?.total_rows ?? 0;
      const duration = payload?.duration_ms ?? Math.round(performance.now() - t0);
      setResult({ total, duration, counts: payload?.counts ?? {} });
      toast.success(`Final Reset complete — ${total.toLocaleString("en-IN")} records removed in ${duration}ms`);
      setConfirmText("");
      await refetchCounts();
      qc.invalidateQueries();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Reset failed";
      toast.error(`Final Reset rolled back: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card/60 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted/60">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold tracking-tight">Final Reset</h2>
            <p className="text-xs text-muted-foreground">One-shot cleanup that removes all development, testing and temporary data so the site is ready for real customers. The entire operation runs in a single database transaction — if any step fails, nothing is deleted.</p>
          </div>
        </div>
      </div>

      {/* Removed / Preserved */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Will be removed</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{grandTotal.toLocaleString("en-IN")} total</div>
          </div>
          <ul className="divide-y divide-border/40">
            {removeList.map((r) => (
              <li key={r.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${r.count === 0 ? "border-border/40 bg-muted/30 text-muted-foreground" : "border-border/60 bg-muted/60 text-foreground"}`}>
                  {r.count.toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          <div className="border-b border-border/50 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Will be preserved
          </div>
          <ul className="divide-y divide-border/40">
            {PREP_PRESERVE.map((label) => (
              <li key={label} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Optional */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Optional cleanup</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 text-sm transition hover:border-border">
            <input type="checkbox" checked={includeFlash} onChange={(e) => setIncludeFlash(e.target.checked)} className="mt-0.5 h-4 w-4 accent-foreground" />
            <span className="min-w-0">
              <span className="block font-medium">Clear Flash Announcement Banner</span>
              <span className="block text-xs text-muted-foreground">Removes every scrolling banner item.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 text-sm transition hover:border-border">
            <input type="checkbox" checked={includeNotifs} onChange={(e) => setIncludeNotifs(e.target.checked)} className="mt-0.5 h-4 w-4 accent-foreground" />
            <span className="min-w-0">
              <span className="block font-medium">Clear Notification history</span>
              <span className="block text-xs text-muted-foreground">Removes the historical announcement log.</span>
            </span>
          </label>
        </div>
      </div>

      {/* Confirmation */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Confirmation</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Type <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold text-foreground">RESET</span> to enable the button below.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,16rem)_auto]">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
            className="h-10 font-mono uppercase tracking-widest"
            disabled={busy}
          />
          <Button
            variant="destructive"
            disabled={!canPrepare}
            onClick={runPrepare}
            className="h-10"
          >
            {busy ? "Running Final Reset…" : grandTotal === 0 ? "Nothing to reset" : `Run Final Reset (${grandTotal.toLocaleString("en-IN")})`}
          </Button>
        </div>
      </div>

      {result ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Reset complete
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/50 bg-background/40 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Records removed</div>
              <div className="mt-1 font-mono text-2xl font-bold">{result.total.toLocaleString("en-IN")}</div>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/40 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Duration</div>
              <div className="mt-1 font-mono text-2xl font-bold">{result.duration}ms</div>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/40 px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Result</div>
              <div className="mt-1 font-mono text-2xl font-bold">Success</div>
            </div>
          </div>
          {Object.keys(result.counts).length > 0 ? (
            <details className="mt-3">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Per-scope breakdown</summary>
              <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                {Object.entries(result.counts).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border/40 py-1">
                    <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
                    <span className="font-mono">{v.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      <ResetAuditSection />
      {confirmDialog}
    </div>
  );
}





function ResetAuditSection() {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["reset-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .in("action", ["master_reset", "prepare_for_production", "final_reset"])
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Array<{
        id: string; created_at: string; actor_email: string | null; action: string;
        entity_type: string | null; metadata: { scope?: string; rows_affected?: number; total_rows?: number; duration_ms?: number } | null;
      }>;
    },
  });

  const scopes = useMemo(() => Array.from(new Set((logs ?? []).map((l) => l.entity_type ?? "").filter(Boolean))), [logs]);
  const staff = useMemo(() => Array.from(new Set((logs ?? []).map((l) => l.actor_email ?? "").filter(Boolean))), [logs]);

  const filtered = useMemo(() => {
    let list = logs ?? [];
    if (scopeFilter !== "all") list = list.filter((l) => l.entity_type === scopeFilter);
    if (staffFilter !== "all") list = list.filter((l) => l.actor_email === staffFilter);
    if (dateFrom) list = list.filter((l) => new Date(l.created_at) >= new Date(dateFrom));
    if (dateTo) list = list.filter((l) => new Date(l.created_at) <= new Date(dateTo + "T23:59:59"));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        (l.actor_email ?? "").toLowerCase().includes(q) ||
        (l.entity_type ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, search, scopeFilter, staffFilter, dateFrom, dateTo]);

  function rowsOf(l: { metadata: { rows_affected?: number; total_rows?: number } | null }) {
    return l.metadata?.rows_affected ?? l.metadata?.total_rows ?? 0;
  }
  function typeOf(l: { action: string; entity_type: string | null }) {
    return l.action === "prepare_for_production" || l.action === "final_reset" ? "final_reset" : (l.entity_type ?? "—");
  }

  function exportCsv() {
    const rows = filtered.map((l) => {
      const rows_affected = rowsOf(l);
      return {
        Timestamp: new Date(l.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        Staff: l.actor_email ?? "—",
        "Reset Type": typeOf(l),
        "Records Removed": rows_affected,
        Result: rows_affected > 0 ? "Success" : "No Action Needed",
      };
    });
    const headers = Object.keys(rows[0] ?? { Timestamp: "", Staff: "", "Reset Type": "", "Records Removed": "", Result: "" });
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${String((r as Record<string, unknown>)[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `reset-audit-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Reset Audit Log", 40, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`${filtered.length} entries · Generated ${new Date().toLocaleString("en-IN")}`, 40, 58);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 80,
      head: [["When", "Staff", "Reset Type", "Removed", "Result"]],
      body: filtered.map((l) => {
        const rows = rowsOf(l);
        return [
          new Date(l.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          l.actor_email ?? "—",
          l.entity_type ?? "—",
          String(rows),
          rows > 0 ? "Success" : "No Action Needed",
        ];
      }),
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [20, 20, 20], textColor: 255 },
    });
    doc.save(`reset-audit-${new Date().toISOString().slice(0,10)}.pdf`);
  }

  return (
    <SettingsSection title="Reset Audit" description="Every reset attempt is recorded here, matching the log style used in Auction Logs and Order Logs.">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff or type…" className="h-9 w-64 pl-9" />
        </div>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Reset type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {scopes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger className="h-9 w-52"><SelectValue placeholder="Staff" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All staff</SelectItem>
            {staff.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40" />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</Button>
          <Button size="sm" variant="outline" onClick={exportPdf} disabled={filtered.length === 0}>Export PDF</Button>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-border/60 bg-background/40">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No reset activity recorded yet.</div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((l) => {
              const rows = rowsOf(l);
              const result = rows > 0 ? "Success" : "No Action Needed";
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground min-w-[10rem]">
                    {new Date(l.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </span>
                  <span className="min-w-[12rem] truncate">{l.actor_email ?? "—"}</span>
                  <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest">{typeOf(l)}</span>
                  <span className="font-mono text-xs">{rows.toLocaleString("en-IN")} removed</span>
                  <span className={`ml-auto rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${result === "Success" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" : "bg-muted text-muted-foreground border-border/60"}`}>
                    {result}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}


// ---------- Generic blob editor ----------
type BlobField = {
  key: string;
  label: string;
  type?: "text" | "number" | "email" | "boolean" | "csv";
  multiline?: boolean;
  step?: number;
  hint?: string;
};

function BlobEditor<T extends Record<string, unknown>>({
  defaults, value, fields, busy, onSave,
}: {
  defaults: T;
  value: T;
  fields: BlobField[];
  busy?: boolean;
  onSave: (v: T) => void;
}) {
  const [draft, setDraft] = useState<T>(value);
  useEffect(() => setDraft(value), [value]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  function set(key: string, v: unknown) {
    setDraft((d) => ({ ...d, [key]: v }) as T);
  }

  return (
    <div className="space-y-3">
      {fields.map((f) => {
        const v = (draft as Record<string, unknown>)[f.key];
        const hint = f.hint ? <p className="mt-1.5 text-[11px] text-muted-foreground">{f.hint}</p> : null;
        if (f.type === "boolean") {
          return (
            <div key={f.key} className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{f.label}</div>
                {f.hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{f.hint}</div> : null}
              </div>
              <Switch checked={!!v} disabled={busy} onCheckedChange={(x) => set(f.key, x)} />
            </div>
          );
        }
        if (f.type === "csv") {
          const arr = Array.isArray(v) ? (v as string[]) : [];
          return (
            <div key={f.key} className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
              <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{f.label}</Label>
              <Textarea rows={2} disabled={busy} value={arr.join(", ")}
                onChange={(e) => set(f.key, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
              {hint}
            </div>
          );
        }
        if (f.type === "number") {
          return (
            <div key={f.key} className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
              <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{f.label}</Label>
              <Input type="number" step={f.step ?? 1} disabled={busy}
                value={typeof v === "number" ? v : Number(v ?? 0)}
                onChange={(e) => set(f.key, Number(e.target.value))} className="max-w-xs" />
              {hint}
            </div>
          );
        }
        return (
          <div key={f.key} className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
            <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{f.label}</Label>
            {f.multiline ? (
              <Textarea rows={2} disabled={busy} value={typeof v === "string" ? v : ""}
                onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <Input type={f.type ?? "text"} disabled={busy} value={typeof v === "string" ? v : ""}
                onChange={(e) => set(f.key, e.target.value)} />
            )}
            {hint}
          </div>
        );
      })}
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" disabled={!dirty || busy} onClick={() => setDraft(value)}>Reset</Button>
        <Button size="sm" disabled={!dirty || busy} onClick={() => onSave(draft)}>
          <Save className="mr-1.5 h-3.5 w-3.5" /> Save section
        </Button>
      </div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Defaults available — {Object.keys(defaults).length} fields.
      </div>
    </div>
  );
}

// ---------- Footer link list editor ----------
function FooterLinksEditor({
  label, value, disabled, onSave,
}: {
  label: string;
  value: FooterLink[];
  disabled?: boolean;
  onSave: (v: FooterLink[]) => void;
}) {
  const [draft, setDraft] = useState<FooterLink[]>(value);
  useEffect(() => setDraft(value), [value]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
        <Button size="sm" variant="outline" disabled={disabled}
          onClick={() => setDraft((d) => [...d, { label: "", href: "" }])}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add link
        </Button>
      </div>
      <div className="space-y-2">
        {draft.length === 0 ? (
          <div className="text-xs text-muted-foreground">No links. Click "Add link" to create one.</div>
        ) : draft.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr,1.5fr,auto] gap-2">
            <Input placeholder="Label" value={l.label} disabled={disabled}
              onChange={(e) => setDraft((d) => d.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <Input placeholder="/path or https://…" value={l.href} disabled={disabled}
              onChange={(e) => setDraft((d) => d.map((x, j) => j === i ? { ...x, href: e.target.value } : x))} />
            <Button size="icon" variant="outline" className="text-destructive hover:bg-destructive/10" disabled={disabled}
              onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={!dirty || disabled} onClick={() => setDraft(value)}>Reset</Button>
        <Button size="sm" disabled={!dirty || disabled} onClick={() => onSave(draft.filter((l) => l.label && l.href))}>
          <Save className="mr-1.5 h-3.5 w-3.5" /> Save
        </Button>
      </div>
    </div>
  );
}

// ---------- Announcements CRUD ----------

type AnnouncementRow = {
  id: string;
  title: string | null;
  body: string | null;
  kind: string;
  link: string | null;
  active: boolean;
  pinned: boolean;
  channel: string;
  display_order: number;
  push_sent: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
};

/** IST helpers — the form works in IST regardless of the browser TZ. */
const IST_OFFSET_MIN = 330;
function toIstParts(iso: string | null | undefined) {
  if (!iso) return { date: "", h: "", m: "", s: "" };
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return {
    date: `${yyyy}-${mm}-${dd}`,
    h: String(shifted.getUTCHours()).padStart(2, "0"),
    m: String(shifted.getUTCMinutes()).padStart(2, "0"),
    s: String(shifted.getUTCSeconds()).padStart(2, "0"),
  };
}
function fromIstParts(date: string, h: string, m: string, s: string): string | null {
  if (!date) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const hh = Number(h || 0);
  const mm = Number(m || 0);
  const ss = Number(s || 0);
  if (!y || !mo || !d) return null;
  // Build the UTC timestamp that corresponds to the given IST wall clock.
  const utcMs = Date.UTC(y, mo - 1, d, hh, mm, ss) - IST_OFFSET_MIN * 60_000;
  return new Date(utcMs).toISOString();
}
function todayIstDate(): string {
  return toIstParts(new Date().toISOString()).date;
}

function announcementStatus(a: AnnouncementRow): "active" | "scheduled" | "expired" | "disabled" {
  if (!a.active) return "disabled";
  const now = Date.now();
  if (a.starts_at && new Date(a.starts_at).getTime() > now) return "scheduled";
  if (a.expires_at && new Date(a.expires_at).getTime() <= now) return "expired";
  return "active";
}

function StatusBadge({ s }: { s: ReturnType<typeof announcementStatus> }) {
  const map: Record<typeof s, string> = {
    active: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    scheduled: "bg-sky-500/15 text-sky-500 border-sky-500/30",
    expired: "bg-muted text-muted-foreground border-border/60",
    disabled: "bg-destructive/15 text-destructive border-destructive/30",
  } as const;
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${map[s]}`}>{s}</span>
  );
}

function ThemeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {(Object.keys(FLASH_THEMES) as FlashTheme[]).map((k) => (
        <option key={k} value={k}>{FLASH_THEMES[k].label}</option>
      ))}
    </select>
  );
}

function DiamondSwatch({ kind, className = "" }: { kind: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block rotate-45 ${className}`}
      style={{ width: 10, height: 10, background: themeColor(kind) }}
    />
  );
}

function ISTDateTimePicker({
  value,
  onChange,
  required,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  required?: boolean;
}) {
  const parts = toIstParts(value);
  const [date, setDate] = useState(parts.date || todayIstDate());
  const to12 = (h24: string) => {
    const n = Number(h24 || 0);
    const ampm = n >= 12 ? "PM" : "AM";
    const h12 = n % 12 === 0 ? 12 : n % 12;
    return { h12: String(h12), ampm };
  };
  const init12 = to12(parts.h);
  const [h12, setH12] = useState(init12.h12);
  const [m, setM] = useState(parts.m || "00");
  const [ampm, setAmpm] = useState<"AM" | "PM">(init12.ampm as "AM" | "PM");

  useEffect(() => {
    const p = toIstParts(value);
    setDate(p.date || todayIstDate());
    const c = to12(p.h);
    setH12(c.h12);
    setM(p.m || "00");
    setAmpm(c.ampm as "AM" | "PM");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(nd: string, nh12: string, nm: string, nap: "AM" | "PM") {
    if (!nd) { onChange(null); return; }
    let h = Number(nh12) % 12;
    if (nap === "PM") h += 12;
    onChange(fromIstParts(nd, String(h).padStart(2, "0"), nm.padStart(2, "0"), "00"));
  }

  const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        value={date}
        required={required}
        className="h-9 w-[10.5rem]"
        onChange={(e) => { setDate(e.target.value); commit(e.target.value, h12, m, ampm); }}
      />
      <select aria-label="Hour" className={selectCls} value={h12}
        onChange={(e) => { setH12(e.target.value); commit(date, e.target.value, m, ampm); }}>
        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((v) => (
          <option key={v} value={v}>{v.padStart(2, "0")}</option>
        ))}
      </select>
      <span className="text-muted-foreground">:</span>
      <select aria-label="Minute" className={selectCls} value={m}
        onChange={(e) => { setM(e.target.value); commit(date, h12, e.target.value, ampm); }}>
        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <select aria-label="AM or PM" className={selectCls} value={ampm}
        onChange={(e) => { const v = e.target.value as "AM" | "PM"; setAmpm(v); commit(date, h12, m, v); }}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">IST</span>
    </div>
  );
}



type FlashEditorItem = {
  clientId: string;
  id?: string;
  body: string;
  link: string;
  created_at?: string;
  active?: boolean;
};
const makeClientId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const emptyFlashItem = (): FlashEditorItem => ({ clientId: makeClientId(), body: "", link: "", active: true });
const rowToFlashItem = (a: AnnouncementRow): FlashEditorItem => ({
  clientId: a.id,
  id: a.id,
  body: a.body ?? a.title ?? "",
  link: a.link ?? "",
  created_at: a.created_at,
  active: a.active,
});

type NotifDraft = {
  id?: string;
  title: string;
  body: string;
  kind: string;
  link: string;
  push: boolean;
};
const emptyNotifDraft = (): NotifDraft => ({
  title: "", body: "", kind: "default", link: "", push: true,
});


function useAnnouncementList(channel: "flash" | "notification") {
  return useQuery({
    queryKey: ["announcements-admin", channel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("channel", channel)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnnouncementRow[];
    },
  });
}

function FlashAnnouncementsAdmin() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const { data: list, isLoading } = useAnnouncementList("flash");
  const [items, setItems] = useState<FlashEditorItem[]>(() => [emptyFlashItem()]);
  const [dirty, setDirty] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const publishedItems = useMemo(() => list ?? [], [list]);

  useEffect(() => {
    if (!list) return;
    setItems(list.length > 0 ? list.map(rowToFlashItem) : [emptyFlashItem()]);
    setDirty(false);
  }, [list]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["announcements-admin", "flash"] });
    qc.invalidateQueries({ queryKey: ["announcements-active"] });
    qc.invalidateQueries({ queryKey: ["announcements-public"] });
  };

  const save = useMutation({
    mutationFn: async (nextItems: FlashEditorItem[]) => {
      const normalized = nextItems
        .map((item, index) => ({ ...item, body: item.body.trim(), link: item.link.trim(), display_order: index }))
        .filter((item) => item.body.length > 0);
      if (normalized.length === 0) throw new Error("Add at least one banner item before publishing.");

      const keepIds = new Set(normalized.map((item) => item.id).filter(Boolean));
      const removeIds = (list ?? []).map((item) => item.id).filter((id) => !keepIds.has(id));
      if (removeIds.length > 0) {
        const { error } = await supabase.from("announcements").delete().in("id", removeIds);
        if (error) throw error;
      }

      const updates = normalized.filter((item) => item.id);
      const inserts = normalized.filter((item) => !item.id);
      for (const item of updates) {
        const { error } = await supabase
          .from("announcements")
          .update({
            title: item.body,
            body: item.body,
            kind: "default",
            link: item.link || null,
            display_order: item.display_order,
            channel: "flash",
            active: true,
            starts_at: null,
            expires_at: null,
          })
          .eq("id", item.id!);
        if (error) throw error;
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from("announcements").insert(inserts.map((item) => ({
          title: item.body,
          body: item.body,
          kind: "default",
          link: item.link || null,
          display_order: item.display_order,
          channel: "flash",
          active: true,
          starts_at: null,
          expires_at: null,
          push_sent: false,
        })));
        if (error) throw error;
      }
    },
    onSuccess: () => { setDirty(false); invalidate(); toast.success("Flash Announcement Banner saved"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Flash Announcement Banner could not be saved"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Banner item deleted"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not delete banner item"),
  });

  function updateItem(clientId: string, patch: Partial<FlashEditorItem>) {
    setItems((current) => current.map((item) => item.clientId === clientId ? { ...item, ...patch } : item));
    setDirty(true);
  }

  function deleteDraftItem(clientId: string) {
    setItems((current) => current.length <= 1 ? [emptyFlashItem()] : current.filter((item) => item.clientId !== clientId));
    setDirty(true);
  }

  function moveItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= items.length) return;
    setItems((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDirty(true);
  }

  function dropOn(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const from = items.findIndex((item) => item.clientId === draggingId);
    const to = items.findIndex((item) => item.clientId === targetId);
    moveItem(from, to);
    setDraggingId(null);
  }

  const previewItems: FlashBannerItem[] = items
    .filter((item) => item.body.trim())
    .map((item) => ({ id: item.clientId, body: item.body.trim(), link: item.link.trim() || null }));

  return (
    <SettingsSection
      title="Flash Announcement Banner"
      description="Manages ONLY the scrolling banner shown above the navigation. Never creates notifications."
    >
      <div className="rounded-xl border border-border/60 bg-background/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Banner editor</div>
            <p className="mt-1 text-xs text-muted-foreground">Create each scrolling message as its own item. Drag items to change the banner order.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => { setItems((current) => [...current, emptyFlashItem()]); setDirty(true); }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Banner Item
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <div
              key={item.clientId}
              draggable
              onDragStart={() => setDraggingId(item.clientId)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOn(item.clientId)}
              onDragEnd={() => setDraggingId(null)}
              className={`rounded-lg border border-border/60 bg-card/30 p-4 ${draggingId === item.clientId ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="cursor-grab rounded-md border border-border/60 px-2 py-1 font-mono text-xs text-muted-foreground active:cursor-grabbing"
                    aria-label={`Drag Banner Item ${index + 1}`}
                  >
                    ⋮⋮
                  </button>
                  <div className="text-sm font-semibold">Banner Item {index + 1}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" disabled={index === 0} onClick={() => moveItem(index, index - 1)} aria-label="Move item up">↑</Button>
                  <Button size="icon" variant="outline" disabled={index === items.length - 1} onClick={() => moveItem(index, index + 1)} aria-label="Move item down">↓</Button>
                  <Button size="icon" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => deleteDraftItem(item.clientId)} aria-label="Delete banner item">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div>
                  <Label className="mb-1.5 block text-xs">Text<RequiredMark /></Label>
                  <Input value={item.body} onChange={(e) => updateItem(item.clientId, { body: e.target.value })} placeholder="Summer Sale Live" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Optional Link</Label>
                  <Input value={item.link} onChange={(e) => updateItem(item.clientId, { link: e.target.value })} placeholder="/shop or https://…" />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked readOnly className="h-4 w-4 accent-current" />
                <span>Separator After This Item</span>
                <span className="font-mono text-base text-foreground">◆</span>
                <span>Bold Diamond</span>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Live Preview</div>
          {previewItems.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-border/60">
              <FlashBannerStrip items={previewItems} animate={false} className="border-b-0" />
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">Add text to preview the Flash Announcement Banner.</div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" disabled={!dirty || save.isPending || isLoading} onClick={() => { setItems(publishedItems.length > 0 ? publishedItems.map(rowToFlashItem) : [emptyFlashItem()]); setDirty(false); }}>
            Reset
          </Button>
          <Button onClick={() => save.mutate(items)} disabled={save.isPending || isLoading}>
            <Megaphone className="mr-1.5 h-4 w-4" /> Publish Banner
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Published banner items</div>
            <p className="text-xs text-muted-foreground">Saved items currently available to the storefront banner.</p>
          </div>
        </div>
        {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div>
          : publishedItems.length === 0 ? <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">No Flash Announcement Banner items yet.</div>
          : (
            <div className="space-y-2">
              {publishedItems.map((a) => (
                <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/40 p-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold truncate">{flashBannerLabel(a)}</span>
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${a.active ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" : "bg-destructive/15 text-destructive border-destructive/30"}`}>
                        {a.active ? "active" : "disabled"}
                      </span>
                    </div>
                    {a.link ? <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">→ {a.link}</div> : null}
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Created {new Date(a.created_at).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="outline"
                      onClick={() => { setItems(publishedItems.map(rowToFlashItem)); setDirty(false); }}>
                      Edit
                    </Button>
                    <Button size="icon" variant="outline" className="text-destructive hover:bg-destructive/10"
                      onClick={async () => { const ok = await confirm({ title: "Delete banner item?", description: "The Flash Announcement Banner entry will be removed immediately.", destructive: true, confirmText: "Delete" }); if (ok) remove.mutate(a.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
      {confirmDialog}
    </SettingsSection>
  );
}



const NOTIF_KIND_META: Record<string, { label: string; hint: string; Icon: typeof Bell; tone: string; bg: string; ring: string }> = {
  default:     { label: "Default",     hint: "General news & updates",              Icon: Sparkles,      tone: "text-muted-foreground", bg: "bg-muted/60",         ring: "ring-border" },
  promo:       { label: "Promo",       hint: "Sales, discounts & offers",           Icon: Tag,           tone: "text-fuchsia-400",      bg: "bg-fuchsia-500/10",   ring: "ring-fuchsia-500/40" },
  limited:     { label: "Limited",     hint: "Low stock, last chance",              Icon: Zap,           tone: "text-amber-400",        bg: "bg-amber-500/10",     ring: "ring-amber-500/40" },
  important:   { label: "Important",   hint: "Urgent, high-priority alerts",        Icon: AlertTriangle, tone: "text-red-400",          bg: "bg-red-500/10",       ring: "ring-red-500/40" },
  maintenance: { label: "Maintenance", hint: "Scheduled downtime, technical",       Icon: Info,          tone: "text-cyan-400",         bg: "bg-cyan-500/10",       ring: "ring-cyan-500/40" },
};

function niceTimeAgo(iso: string) {
  const diff = Date.now() - +new Date(iso);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function NotificationAnnouncementsAdmin() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const { data: list, isLoading } = useAnnouncementList("notification");
  const [draft, setDraft] = useState<NotifDraft>(emptyNotifDraft);
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled" | "pushed">("all");
  const [search, setSearch] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["announcements-admin", "notification"] });
    qc.invalidateQueries({ queryKey: ["admin-notifs"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.title.trim()) throw new Error("Title is required");
      if (!draft.body.trim()) throw new Error("Body is required");
      const payload = {
        title: draft.title.trim(),
        body: draft.body.trim(),
        kind: draft.kind,
        link: draft.link.trim() || null,
        display_order: 0,
        channel: "notification",
        active: true,
        starts_at: null,
        expires_at: null,
        push_sent: draft.push,
      };
      if (draft.id) {
        const { push_sent: _ignore, ...patch } = payload;
        const { error } = await supabase.from("announcements").update(patch).eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("announcements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setDraft(emptyNotifDraft());
      invalidate();
      toast.success(draft.id ? "Notification updated" : "Notification published");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AnnouncementRow> }) => {
      const { error } = await supabase.from("announcements").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Notification deleted"); },
  });

  const editing = !!draft.id;
  const rawList = list ?? [];
  const filtered = rawList.filter((a) => {
    if (filter === "enabled" && !a.active) return false;
    if (filter === "disabled" && a.active) return false;
    if (filter === "pushed" && !a.push_sent) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!((a.title ?? "").toLowerCase().includes(q) || (a.body ?? "").toLowerCase().includes(q))) return false;
    }
    return true;
  });
  const totals = {
    all: rawList.length,
    enabled: rawList.filter((a) => a.active).length,
    disabled: rawList.filter((a) => !a.active).length,
    pushed: rawList.filter((a) => a.push_sent).length,
  };

  const kindMeta = NOTIF_KIND_META[draft.kind] ?? NOTIF_KIND_META.default;
  const KindIcon = kindMeta.Icon;
  const titleCount = draft.title.length;
  const bodyCount = draft.body.length;

  return (
    <div className="space-y-6">
      {/* Header + builder + preview */}
      <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-bold">{editing ? "Edit notification" : "Notification builder"}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Compose a message that appears in every user's notification bell and history.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline-flex">
              {rawList.length} live · {totals.pushed} pushed
            </span>
          </div>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[1.15fr_1fr]">
          {/* LEFT — form */}
          <div className="space-y-5">
            {/* Kind picker */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Category<RequiredMark />
                </Label>
                <span className="text-[11px] text-muted-foreground">Sets colour, icon and tone</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(Object.keys(NOTIF_KIND_META) as (keyof typeof NOTIF_KIND_META)[]).map((k) => {
                  const meta = NOTIF_KIND_META[k];
                  const Icon = meta.Icon;
                  const active = draft.kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setDraft({ ...draft, kind: k })}
                      className={`group flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                        active
                          ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                          : "border-border/60 bg-background/40 hover:border-primary/40 hover:bg-background/60"
                      }`}
                    >
                      <div className={`grid h-8 w-8 place-items-center rounded-lg ${meta.bg} ${meta.tone}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-[11px] font-semibold">{meta.label}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{kindMeta.hint}</p>
            </div>

            {/* Title + body */}
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Title<RequiredMark />
                  </Label>
                  <span className={`text-[10px] font-mono ${titleCount > 80 ? "text-destructive" : "text-muted-foreground/70"}`}>{titleCount}/80</span>
                </div>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value.slice(0, 80) })}
                  placeholder="e.g. New drop: Skyline GT-R R34"
                  className="h-10"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Message<RequiredMark />
                  </Label>
                  <span className={`text-[10px] font-mono ${bodyCount > 220 ? "text-destructive" : "text-muted-foreground/70"}`}>{bodyCount}/220</span>
                </div>
                <Textarea
                  rows={3}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value.slice(0, 220) })}
                  placeholder="Add a short, clear sentence users see in the panel…"
                />
              </div>
            </div>

            {/* Link */}
            <div>
              <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Action link <span className="normal-case tracking-normal text-muted-foreground/70">(optional)</span>
              </Label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={draft.link}
                  onChange={(e) => setDraft({ ...draft, link: e.target.value })}
                  placeholder="/shop, /auction, or https://…"
                  className="h-10 pl-9"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Users tap the card to open this URL.</p>
            </div>

            {/* Push toggle */}
            {!editing ? (
              <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Send className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Send as push</div>
                    <Switch checked={draft.push} onCheckedChange={(v) => setDraft({ ...draft, push: v })} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Marks the record as pushed so users see it as new the next time they open the bell. Cannot be undone.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                Editing an existing notification never re-sends push.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
              {editing ? (
                <Button variant="outline" onClick={() => setDraft(emptyNotifDraft())}>
                  <XIcon className="mr-1.5 h-3.5 w-3.5" /> Cancel edit
                </Button>
              ) : null}
              <Button onClick={() => save.mutate()} disabled={save.isPending || !draft.title.trim() || !draft.body.trim()}>
                <Megaphone className="mr-1.5 h-4 w-4" />
                {editing ? "Save changes" : draft.push ? "Publish & push" : "Publish"}
              </Button>
            </div>
          </div>

          {/* RIGHT — live preview */}
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <Eye className="h-3 w-3" /> Live preview
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-border/40 pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Bell className="h-3 w-3" /> Notifications</span>
                <span>preview</span>
              </div>
              <div className={`relative rounded-xl border border-border/60 bg-primary/[0.03] p-3.5 ring-1 ${kindMeta.ring}`}>
                <span aria-hidden className="absolute left-0 top-0 h-full w-0.5 rounded-l-xl bg-primary" />
                <div className="flex items-start gap-3 pl-1.5">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${kindMeta.bg} ${kindMeta.tone}`}>
                    <KindIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[9px] uppercase tracking-[0.22em] ${kindMeta.tone}`}>{kindMeta.label}</span>
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                    </div>
                    <div className="mt-0.5 truncate text-sm font-semibold">{draft.title || "Notification title"}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{draft.body || "Your message will appear here."}</div>
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">just now</div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                This is exactly how the card looks in every user's bell — icon, colour, hierarchy and spacing.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Published notifications */}
      <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent px-5 py-4">
          <div>
            <div className="text-base font-bold">Published notifications</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Manage what users see in their bell.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or body…"
                className="h-9 w-56 pl-9"
              />
            </div>
            <div className="inline-flex rounded-full border border-border/60 bg-background/40 p-0.5">
              {([
                { k: "all",      label: `All (${totals.all})` },
                { k: "enabled",  label: `Enabled (${totals.enabled})` },
                { k: "disabled", label: `Disabled (${totals.disabled})` },
                { k: "pushed",   label: `Pushed (${totals.pushed})` },
              ] as const).map((f) => (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    filter === f.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="grid gap-2">
              {[0,1,2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-border/60 bg-muted/30" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-muted/50">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-1 text-sm font-semibold">
                {rawList.length === 0 ? "No notifications yet" : "No matches for these filters"}
              </div>
              <div className="text-xs text-muted-foreground">
                {rawList.length === 0 ? "Publish your first notification from the builder above." : "Try adjusting the search or category."}
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {filtered.map((a) => {
                const meta = NOTIF_KIND_META[a.kind ?? "default"] ?? NOTIF_KIND_META.default;
                const Icon = meta.Icon;
                return (
                  <div
                    key={a.id}
                    className={`group relative flex flex-col gap-3 rounded-xl border border-border/60 bg-background/40 p-3.5 transition-colors hover:bg-background/60 sm:flex-row sm:items-start ${
                      a.active ? "" : "opacity-70"
                    }`}
                  >
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.bg} ${meta.tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold truncate">{a.title}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${meta.bg} ${meta.tone}`}>
                          {meta.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${a.active ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-border/60 bg-muted/40 text-muted-foreground"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${a.active ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                          {a.active ? "Enabled" : "Disabled"}
                        </span>
                        {a.push_sent ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
                            <Send className="h-2.5 w-2.5" /> Pushed
                          </span>
                        ) : null}
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{niceTimeAgo(a.created_at)}</span>
                      </div>
                      {a.body ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.body}</p> : null}
                      {a.link ? (
                        <a href={a.link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary hover:underline">
                          <Link2 className="h-3 w-3" /> {a.link}
                        </a>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => update.mutate({ id: a.id, patch: { active: !a.active } })}
                      >
                        {a.active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setDraft({
                          id: a.id, title: a.title ?? "", body: a.body ?? "", kind: a.kind || "default",
                          link: a.link ?? "", push: a.push_sent,
                        })}
                      >
                        Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Delete this notification?",
                            description: "It will be removed from the bell and every user's history. This cannot be undone.",
                            confirmText: "Delete",
                            destructive: true,
                          });
                          if (ok) remove.mutate(a.id);
                        }}
                        aria-label="Delete notification"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}



function AnnouncementsAdmin() {
  return (
    <div className="space-y-6">
      <FlashAnnouncementsAdmin />
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
      <div className="mb-5 flex items-center gap-2">
        <SettingsIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {description ? (
        <p className="-mt-3 mb-5 max-w-prose text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function TextRow({
  label,
  hint,
  placeholder,
  value,
  disabled,
  onSave,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  disabled?: boolean;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const dirty = v !== value;
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
      <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </Label>
      {hint ? <div className="mb-2 text-xs text-muted-foreground">{hint}</div> : null}
      <div className="flex gap-2">
        <Input
          value={v}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
        />
        <Button size="sm" disabled={!dirty || disabled} onClick={() => onSave(v)}>
          Save
        </Button>
      </div>
    </div>
  );
}

function TextareaRow({
  label,
  hint,
  value,
  disabled,
  onSave,
}: {
  label: string;
  hint?: string;
  value: string;
  disabled?: boolean;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const dirty = v !== value;
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
      <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </Label>
      {hint ? <div className="mb-2 text-xs text-muted-foreground">{hint}</div> : null}
      <Textarea rows={3} value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} />
      <div className="mt-2 flex justify-end">
        <Button size="sm" disabled={!dirty || disabled} onClick={() => onSave(v)}>
          Save
        </Button>
      </div>
    </div>
  );
}

function NumberRow({
  label,
  hint,
  value,
  min,
  disabled,
  onSave,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  disabled?: boolean;
  onSave: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const parsed = Number(v);
  const dirty = parsed !== value && Number.isFinite(parsed);
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
      <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </Label>
      {hint ? <div className="mb-2 text-xs text-muted-foreground">{hint}</div> : null}
      <div className="flex gap-2">
        <Input
          type="number"
          min={min}
          value={v}
          disabled={disabled}
          onChange={(e) => setV(e.target.value)}
          className="max-w-[10rem]"
        />
        <Button size="sm" disabled={!dirty || disabled} onClick={() => onSave(parsed)}>
          Save
        </Button>
      </div>
    </div>
  );
}

function RupeeRow({
  label,
  hint,
  cents,
  disabled,
  onSave,
}: {
  label: string;
  hint?: string;
  cents: number;
  disabled?: boolean;
  onSave: (cents: number) => void;
}) {
  const rupees = Math.round((cents ?? 0) / 100);
  const [v, setV] = useState(String(rupees));
  useEffect(() => setV(String(rupees)), [rupees]);
  const parsed = Number(v);
  const dirty = Number.isFinite(parsed) && Math.round(parsed) * 100 !== cents;
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
      <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </Label>
      {hint ? <div className="mb-2 text-xs text-muted-foreground">{hint}</div> : null}
      <div className="flex items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground">₹</span>
          <Input
            type="number"
            min={0}
            value={v}
            disabled={disabled}
            onChange={(e) => setV(e.target.value)}
            className="max-w-[10rem] pl-6"
          />
        </div>
        <Button size="sm" disabled={!dirty || disabled} onClick={() => onSave(Math.max(0, Math.round(parsed)) * 100)}>
          Save
        </Button>
      </div>
    </div>
  );
}



// ---------- Auction Manager ----------
type AuctionData = {
  productName: string;
  brand: string;
  series: string;
  scale: string;
  description: string;
  images: string[];
  startingBid: number;
  minIncrement: number;
  rules: string;
};

const EMPTY_AUCTION: AuctionData = {
  productName: "",
  brand: "",
  series: "",
  scale: "1:64",
  description: "",
  images: [],
  startingBid: 0,
  minIncrement: 10,
  rules: "Bids in multiples of the minimum increment.\nTimer resets to 10 seconds on every new bid.\nHighest bid when timer hits 0 wins.",
};

function AuctionsSection() {
  return (
    <Tabs defaultValue="active">
      <TabsList className="flex w-full flex-wrap h-auto gap-1 p-1.5 bg-muted/30">
        <TabsTrigger value="active" className="flex-1 min-w-[130px] px-4 py-2 text-sm font-semibold">Active Auctions</TabsTrigger>
        <TabsTrigger value="drafts" className="flex-1 min-w-[130px] px-4 py-2 text-sm font-semibold">Draft Auctions</TabsTrigger>
        <TabsTrigger value="logs" className="flex-1 min-w-[130px] px-4 py-2 text-sm font-semibold">Auction Logs</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="mt-6"><AuctionsAdmin /></TabsContent>
      <TabsContent value="drafts" className="mt-6"><AuctionDraftsAdmin /></TabsContent>
      <TabsContent value="logs" className="mt-6"><AuctionLogsAdmin /></TabsContent>
    </Tabs>
  );
}

function AuctionsAdmin() {
  const qc = useQueryClient();
  const [form, setForm] = useState<AuctionData>(EMPTY_AUCTION);
  const [loaded, setLoaded] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const { data: rows } = useQuery({
    queryKey: ["auction-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["active_auction"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = useMemo(
    () => (rows ?? []).find((r) => r.key === "active_auction")?.value as AuctionData | undefined,
    [rows],
  );

  useEffect(() => {
    if (loaded || !rows) return;
    setForm(active ?? EMPTY_AUCTION);
    setLoaded(true);
  }, [rows, active, loaded]);

  function set<K extends keyof AuctionData>(key: K, v: AuctionData[K]) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  function validate(): string | null {
    if (!form.productName.trim()) return "Product name is required";
    if (form.images.length === 0) return "Add at least one product image";
    if (form.startingBid <= 0) return "Starting bid must be greater than 0";
    if (form.minIncrement <= 0) return "Minimum increment must be greater than 0";
    return null;
  }

  const save = useMutation({
    mutationFn: async (kind: "draft" | "publish") => {
      if (kind === "publish") {
        const err = validate();
        if (err) throw new Error(err);
      }
      if (kind === "draft") {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("auction_drafts").insert({
          product_name: form.productName,
          brand: form.brand,
          series: form.series,
          scale: form.scale,
          description: form.description,
          images: form.images as unknown as never,
          starting_bid: form.startingBid,
          min_increment: form.minIncrement,
          rules: form.rules,
          created_by: u.user?.id ?? null,
        });
        if (error) throw error;
      } else {
        const payload = { ...form, status: "published", startedAt: null, publishedAt: new Date().toISOString() };
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key: "active_auction", value: payload as unknown as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
      await logAction(kind === "publish" ? "auction.publish" : "auction.draft", "auction", null, { name: form.productName });
    },
    onSuccess: (_d, kind) => {
      qc.invalidateQueries({ queryKey: ["auction-settings"] });
      qc.invalidateQueries({ queryKey: ["site_settings"] });
      qc.invalidateQueries({ queryKey: ["auction-drafts"] });
      toast.success(kind === "publish" ? "Auction published — live on /auction" : "Draft saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearActive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("clear_active_auction");
      if (error) throw error;
      await logAction("auction.end", "auction", null, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auction-settings"] });
      qc.invalidateQueries({ queryKey: ["active_auction"] });
      toast.success("Auction data cleared");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function confirmClear() {
    const ok = await confirm({
      title: "Clear auction data?",
      description: "This wipes chat, bids, participants and the active session. Auction Logs and Drafts are not affected.",
      confirmText: "Clear data",
      destructive: true,
    });
    if (ok) clearActive.mutate();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Gavel className="h-3.5 w-3.5" /> Auction Manager
        </div>
        <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">Create auction</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Product name</Label>
            <Input className="mt-1.5" value={form.productName} onChange={(e) => set("productName", e.target.value)} placeholder="e.g. Nissan Skyline GT-R (R34)" />
          </div>
          <div>
            <Label>Brand</Label>
            <Input className="mt-1.5" value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Hot Wheels" />
          </div>
          <div>
            <Label>Series</Label>
            <Input className="mt-1.5" value={form.series} onChange={(e) => set("series", e.target.value)} placeholder="Premium / Mainline / K Case" />
          </div>
          <div>
            <Label>Scale</Label>
            <Input className="mt-1.5" value={form.scale} onChange={(e) => set("scale", e.target.value)} placeholder="1:64" />
          </div>
          <div>
            <Label>Condition / Note</Label>
            <Input className="mt-1.5" value={form.description.split("\n")[0] ?? ""} onChange={(e) => {
              const rest = form.description.split("\n").slice(1).join("\n");
              set("description", rest ? `${e.target.value}\n${rest}` : e.target.value);
            }} placeholder="Mint Condition" />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea className="mt-1.5" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Details about casting, packaging, provenance…" />
          </div>
          <div className="sm:col-span-2">
            <Label>Product images</Label>
            <div className="mt-1.5">
              <ImageUploader urls={form.images} onChange={(next) => set("images", next)} />
            </div>
          </div>
          <div>
            <Label>Starting bid (₹)</Label>
            <Input type="number" min={0} className="mt-1.5" value={form.startingBid || ""} onChange={(e) => set("startingBid", Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Minimum bid increment (₹)</Label>
            <Input type="number" min={1} className="mt-1.5" value={form.minIncrement || ""} onChange={(e) => set("minIncrement", Number(e.target.value) || 0)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Auction rules</Label>
            <Textarea className="mt-1.5" rows={5} value={form.rules} onChange={(e) => set("rules", e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => save.mutate("draft")} disabled={save.isPending} className="gap-2">
            <Save className="h-4 w-4" /> Save Draft
          </Button>
          <Button onClick={() => save.mutate("publish")} disabled={save.isPending} className="gap-2">
            <Radio className="h-4 w-4" /> Publish Auction
          </Button>
          <div className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Publishing replaces the live auction on <span className="text-foreground">/auction</span>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-emerald-500" /> Live Auction
          </div>
          {active ? (
            <>
              <div className="mt-2 text-lg font-bold">{active.productName}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {[active.brand, active.series, active.scale].filter(Boolean).join(" • ")}
              </div>
              <div className="mt-3 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span>Start ₹{active.startingBid}</span>
                <span className="text-border">•</span>
                <span>Inc ₹{active.minIncrement}</span>
              </div>
              <Button variant="ghost" size="sm" className="mt-3 h-8 gap-2 text-xs text-destructive hover:text-destructive" onClick={confirmClear} disabled={clearActive.isPending}>
                <Trash2 className="h-3.5 w-3.5" /> Clear auction data
              </Button>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No active auction. Publish one to go live.</p>
          )}
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Drafts</div>
          <p className="mt-2 text-sm text-muted-foreground">Manage saved drafts in the <span className="text-foreground">Drafts</span> tab.</p>
        </div>
      </aside>
      {confirmDialog}
    </div>
  );
}

// ---------- Draft Auctions ----------
function AuctionDraftsAdmin() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [preview, setPreview] = useState<AuctionDraftRow | null>(null);
  const [editing, setEditing] = useState<AuctionDraftRow | null>(null);

  const { data: drafts } = useQuery({
    queryKey: ["auction-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_drafts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AuctionDraftRow[];
    },
  });

  const startFromDraft = useMutation({
    mutationFn: async (d: AuctionDraftRow) => {
      const payload = {
        productName: d.product_name,
        brand: d.brand,
        series: d.series,
        scale: d.scale,
        description: d.description,
        images: d.images ?? [],
        startingBid: d.starting_bid,
        minIncrement: d.min_increment,
        rules: d.rules,
        status: "published",
        startedAt: null,
        publishedAt: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "active_auction", value: payload as unknown as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
      await logAction("auction.publish", "auction", null, { name: d.product_name, from: "draft" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auction-settings"] });
      qc.invalidateQueries({ queryKey: ["active_auction"] });
      toast.success("Auction is now live");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("auction_drafts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auction-drafts"] });
      toast.success("Draft deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEdit = useMutation({
    mutationFn: async (d: AuctionDraftRow) => {
      const { error } = await supabase
        .from("auction_drafts")
        .update({
          product_name: d.product_name,
          brand: d.brand,
          series: d.series,
          scale: d.scale,
          description: d.description,
          images: d.images as unknown as never,
          starting_bid: d.starting_bid,
          min_increment: d.min_increment,
          rules: d.rules,
        })
        .eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auction-drafts"] });
      toast.success("Draft updated");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{drafts?.length ?? 0} drafts</div>
      <div className="overflow-hidden rounded-2xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Brand</th>
              <th className="p-3">Starting Bid</th>
              <th className="p-3">Created</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(drafts ?? []).map((d) => (
              <tr key={d.id} className="border-t border-border/60">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                      {d.images?.[0] ? <img src={d.images[0]} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0"><div className="truncate font-semibold">{d.product_name || "Untitled"}</div><div className="truncate text-xs text-muted-foreground">{d.series} • {d.scale}</div></div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{d.brand}</td>
                <td className="p-3 font-mono">₹{d.starting_bid.toLocaleString()}</td>
                <td className="p-3 text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</td>
                <td className="p-3"><Badge variant="outline" className="border-amber-500/50 text-amber-500 text-[10px] uppercase tracking-wider">Draft</Badge></td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(d)}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreview(d)}>Preview</Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        const ok = await confirm({ title: "Start this auction?", description: "This will replace any currently live auction.", confirmText: "Start auction" });
                        if (ok) startFromDraft.mutate(d);
                      }}
                    >Start Auction</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={async () => {
                        const ok = await confirm({ title: "Delete draft?", description: `"${d.product_name || "Untitled"}" will be permanently removed.`, confirmText: "Delete", destructive: true });
                        if (ok) del.mutate(d.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(drafts ?? []).length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No drafts yet. Save one from the Auctions tab.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          {preview ? (
            <>
              <div className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">Preview</div>
              <h3 className="text-2xl font-black uppercase tracking-tight">{preview.product_name}</h3>
              <div className="text-xs text-muted-foreground">{[preview.brand, preview.series, preview.scale].filter(Boolean).join(" • ")}</div>
              {preview.images?.[0] ? <img src={preview.images[0]} alt="" className="aspect-square w-full rounded-lg object-cover" /> : null}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Starting bid</div><div className="font-mono">₹{preview.starting_bid.toLocaleString()}</div></div>
                <div><div className="text-xs text-muted-foreground">Min increment</div><div className="font-mono">₹{preview.min_increment.toLocaleString()}</div></div>
              </div>
              {preview.description ? <p className="whitespace-pre-line text-sm text-foreground/90">{preview.description}</p> : null}
              {preview.rules ? <p className="whitespace-pre-line text-xs text-muted-foreground">{preview.rules}</p> : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          {editing ? (
            <div className="grid gap-3">
              <div className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">Edit draft</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>Product name</Label><Input value={editing.product_name} onChange={(e) => setEditing({ ...editing, product_name: e.target.value })} /></div>
                <div><Label>Brand</Label><Input value={editing.brand} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} /></div>
                <div><Label>Series</Label><Input value={editing.series} onChange={(e) => setEditing({ ...editing, series: e.target.value })} /></div>
                <div><Label>Scale</Label><Input value={editing.scale} onChange={(e) => setEditing({ ...editing, scale: e.target.value })} /></div>
                <div><Label>Starting bid (₹)</Label><Input type="number" value={editing.starting_bid || ""} onChange={(e) => setEditing({ ...editing, starting_bid: Number(e.target.value) || 0 })} /></div>
                <div><Label>Min increment (₹)</Label><Input type="number" value={editing.min_increment || ""} onChange={(e) => setEditing({ ...editing, min_increment: Number(e.target.value) || 0 })} /></div>
                <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Rules</Label><Textarea rows={3} value={editing.rules} onChange={(e) => setEditing({ ...editing, rules: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={() => saveEdit.mutate(editing)} disabled={saveEdit.isPending}>Save</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}

type AuctionDraftRow = {
  id: string;
  product_name: string;
  brand: string;
  series: string;
  scale: string;
  description: string;
  images: string[];
  starting_bid: number;
  min_increment: number;
  rules: string;
  created_at: string;
};

// ---------- Auction Logs ----------
type AuctionLogRow = {
  id: string;
  product_name: string;
  brand: string | null;
  series: string | null;
  scale: string | null;
  image_url: string | null;
  winner_name: string | null;
  winner_email: string | null;
  winner_phone: string | null;
  winning_bid: number | null;
  total_bids: number;
  participant_count: number;
  started_at: string | null;
  ended_at: string;
  duration_seconds: number | null;
  status: string;
  closed_by_name: string | null;
};

function AuctionLogsAdmin() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data: logs } = useQuery({
    queryKey: ["auction-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_logs")
        .select("id,product_name,brand,series,scale,image_url,winner_name,winner_email,winner_phone,winning_bid,total_bids,participant_count,started_at,ended_at,duration_seconds,status,closed_by_name,bid_history")
        .order("ended_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (AuctionLogRow & { bid_history: unknown })[];
    },
  });

  const delMany = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("auction_logs").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auction-logs"] });
      setSelected({});
      toast.success("Logs deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("auction_logs").delete().not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["auction-logs"] }); setSelected({}); toast.success("All logs cleared"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  function fmtDuration(s: number | null) {
    if (s == null) return "—";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{logs?.length ?? 0} logs</div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={(logs?.length ?? 0) === 0}
            onClick={() => downloadCsv(`auction-logs-${new Date().toISOString().slice(0, 10)}.csv`, (logs ?? []).map((l) => ({
              product_name: l.product_name,
              brand: l.brand ?? "",
              series: l.series ?? "",
              scale: l.scale ?? "",
              winner: l.winner_name ?? "",
              winner_email: l.winner_email ?? "",
              winner_phone: displayPhone(l.winner_phone),
              winning_bid_inr: l.winning_bid ?? "",
              total_bids: l.total_bids,
              participants: l.participant_count,
              started_at: l.started_at ?? "",
              ended_at: l.ended_at,
              duration_seconds: l.duration_seconds ?? "",
              status: l.status,
              closed_by: l.closed_by_name ?? "",
            })))}
          ><Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV</Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(logs?.length ?? 0) === 0}
            onClick={async () => {
              const { exportAuctionLogsPdf } = await import("@/lib/auction-pdf");
              const rows = (selectedIds.length > 0 ? (logs ?? []).filter((l) => selectedIds.includes(l.id)) : (logs ?? []));
              exportAuctionLogsPdf(rows as unknown as import("@/lib/auction-pdf").AuctionLogPdf[]);
            }}
          ><Download className="mr-1.5 h-3.5 w-3.5" /> Export PDF</Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(logs?.length ?? 0) === 0}
            onClick={async () => {
              const { exportAuctionAuditPdf } = await import("@/lib/auction-pdf");
              const rows = (selectedIds.length > 0 ? (logs ?? []).filter((l) => selectedIds.includes(l.id)) : (logs ?? []));
              const { data: actions } = await supabase
                .from("audit_log")
                .select("created_at, actor_email, action, entity_id, metadata")
                .in("entity_type", ["auction", "auction_log"])
                .order("created_at", { ascending: true });
              exportAuctionAuditPdf(rows as unknown as import("@/lib/auction-pdf").AuctionLogPdf[], (actions ?? []) as Array<{ created_at: string; actor_email: string | null; action: string; entity_id: string | null; metadata: unknown }>);
            }}
          ><Download className="mr-1.5 h-3.5 w-3.5" /> Export Audit Report</Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedIds.length === 0}
            onClick={async () => {
              const ok = await confirm({ title: `Delete ${selectedIds.length} log(s)?`, description: "This won't affect the current live auction.", confirmText: "Delete", destructive: true });
              if (ok) delMany.mutate(selectedIds);
            }}
          >Delete Selected</Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={(logs?.length ?? 0) === 0}
            onClick={async () => {
              const ok = await confirm({ title: "Clear all auction logs?", description: "This permanently removes every archived auction. Live auction is unaffected.", confirmText: "Clear all", destructive: true });
              if (ok) clearAll.mutate();
            }}
          >Clear All Logs</Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <tr>
              <th className="p-3 w-8"></th>
              <th className="p-3">Product</th>
              <th className="p-3">Winner</th>
              <th className="p-3">Winning bid</th>
              <th className="p-3">Bids</th>
              <th className="p-3">Participants</th>
              <th className="p-3">Started</th>
              <th className="p-3">Ended</th>
              <th className="p-3">Duration</th>
              <th className="p-3">Closed by</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id} className="border-t border-border/60">
                <td className="p-3"><input type="checkbox" checked={!!selected[l.id]} onChange={(e) => setSelected((s) => ({ ...s, [l.id]: e.target.checked }))} /></td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                      {l.image_url ? <img src={l.image_url} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0"><div className="truncate font-semibold">{l.product_name}</div><div className="truncate text-xs text-muted-foreground">{[l.brand, l.series, l.scale].filter(Boolean).join(" • ")}</div></div>
                  </div>
                </td>
                <td className="p-3">
                  {l.winner_name ? (
                    <div>
                      <div className="font-semibold">{l.winner_name}</div>
                      <div className="text-xs text-muted-foreground">{l.winner_email ?? "—"}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{displayPhone(l.winner_phone)}</div>
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3 font-mono">{l.winning_bid ? `₹${l.winning_bid.toLocaleString()}` : "—"}</td>
                <td className="p-3 font-mono">{l.total_bids}</td>
                <td className="p-3 font-mono">{l.participant_count}</td>
                <td className="p-3 text-muted-foreground">{l.started_at ? new Date(l.started_at).toLocaleString() : "—"}</td>
                <td className="p-3 text-muted-foreground">{new Date(l.ended_at).toLocaleString()}</td>
                <td className="p-3 font-mono">{fmtDuration(l.duration_seconds)}</td>
                <td className="p-3 text-muted-foreground">{l.closed_by_name ?? "—"}</td>
              </tr>
            ))}
            {(logs ?? []).length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-sm text-muted-foreground">No auctions ended yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {confirmDialog}
    </div>
  );
}

// ===================== BADGES ADMIN =====================
function BadgesAdmin() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [badgeSearch, setBadgeSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; email: string; display_name: string | null } | null>(null);
  const [editing, setEditing] = useState<{ code: string; name: string; description: string; icon: string; category: string; image_url?: string | null; sort_order?: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{ code: string; name: string; description: string; icon: string; category: string; image_url: string | null; sort_order: number }>({ code: "", name: "", description: "", icon: "Award", category: "General", image_url: null, sort_order: 100 });

  const { data: catalog, refetch: refetchCatalog } = useQuery({
    queryKey: ["badges-catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("badges").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Array<{ code: string; name: string; description: string; icon: string; category: string; image_url: string | null; sort_order: number }>;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["badges-customers", userSearch],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_customers");
      if (error) throw error;
      const rows = (data ?? []) as Array<{ user_id: string; email: string; display_name: string | null }>;
      const q = userSearch.toLowerCase().trim();
      return !q ? rows : rows.filter((r) => r.email?.toLowerCase().includes(q) || (r.display_name ?? "").toLowerCase().includes(q));
    },
  });

  const { data: userBadges } = useQuery({
    enabled: !!selectedUser,
    queryKey: ["user-badges-admin", selectedUser?.user_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("user_badges").select("badge_code, earned_at").eq("user_id", selectedUser!.user_id);
      if (error) throw error;
      return (data ?? []) as Array<{ badge_code: string; earned_at: string }>;
    },
  });

  const { data: badgeOwners } = useQuery({
    enabled: !!editing,
    queryKey: ["badge-owners", editing?.code],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_badges")
        .select("user_id, earned_at, profiles!inner(display_name, avatar_url)")
        .eq("badge_code", editing!.code)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; earned_at: string; profiles: { display_name: string | null; avatar_url: string | null } }>;
    },
  });

  const owned = new Set((userBadges ?? []).map((b) => b.badge_code));

  const grant = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.rpc("admin_grant_badge", { _target: selectedUser!.user_id, _code: code });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Badge granted"); qc.invalidateQueries({ queryKey: ["user-badges-admin", selectedUser?.user_id] }); qc.invalidateQueries({ queryKey: ["badge-owners"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.rpc("admin_revoke_badge", { _target: selectedUser!.user_id, _code: code });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Badge revoked"); qc.invalidateQueries({ queryKey: ["user-badges-admin", selectedUser?.user_id] }); qc.invalidateQueries({ queryKey: ["badge-owners"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function saveBadge() {
    const payload = { ...draft, code: draft.code.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_") };
    if (!payload.code || !payload.name.trim()) return toast.error("Code and name are required");
    const { error } = creating
      ? await (supabase as any).from("badges").insert(payload)
      : await (supabase as any).from("badges").update(payload).eq("code", payload.code);
    if (error) return toast.error(error.message);
    toast.success(creating ? "Badge created" : "Badge saved");
    setCreating(false); setEditing(null); refetchCatalog();
  }

  async function deleteBadge(code: string) {
    const ok = await confirm({ title: `Delete badge "${code}"?`, description: "Removes the badge from every user who owns it.", destructive: true, confirmText: "Delete" });
    if (!ok) return;
    const { error } = await (supabase as any).from("badges").delete().eq("code", code);
    if (error) return toast.error(error.message);
    toast.success("Badge deleted");
    setEditing(null); refetchCatalog();
    qc.invalidateQueries({ queryKey: ["user-badges-admin"] });
  }

  const filteredCatalog = (catalog ?? []).filter((b) => {
    if (!badgeSearch.trim()) return true;
    const q = badgeSearch.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q) || (b.category ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      {/* Catalog management */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-lg font-black uppercase tracking-tight">Badge catalog</h3>
          <Input placeholder="Search badges…" value={badgeSearch} onChange={(e) => setBadgeSearch(e.target.value)} className="h-9 max-w-xs" />
          <Button size="sm" onClick={() => { setCreating(true); setEditing(null); setDraft({ code: "", name: "", description: "", icon: "Award", category: "General", image_url: null, sort_order: (catalog?.length ?? 0) * 10 + 100 }); }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New badge
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCatalog.map((b) => (
            <div key={b.code} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-border/60 bg-muted">
                  {b.image_url ? <img src={b.image_url} alt="" className="h-full w-full object-cover" /> : <span className="font-mono text-[10px] uppercase text-muted-foreground">{b.icon.slice(0, 2)}</span>}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{b.name}</div>
                  <div className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{b.code} · {b.category}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{b.description}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="outline" onClick={() => { setEditing(b); setCreating(false); setDraft({ code: b.code, name: b.name, description: b.description, icon: b.icon, category: b.category, image_url: b.image_url ?? null, sort_order: b.sort_order }); }}>Edit</Button>
                <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => deleteBadge(b.code)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
          {filteredCatalog.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">No badges match.</div>
          ) : null}
        </div>
      </div>

      {/* Create/edit dialog */}
      <Dialog open={creating || !!editing} onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{creating ? "Create badge" : `Edit badge · ${editing?.code}`}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Code</Label><Input value={draft.code} disabled={!creating} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="e.g. og_collector" /></div>
            <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="OG Collector" /></div>
            <div><Label>Description</Label><Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Awarded to early members" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Icon (fallback)</Label><Input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="Award, Trophy, Gem…" /></div>
              <div><Label>Category</Label><Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="General" /></div>
            </div>
            <div>
              <Label className="mb-1 block">Badge image</Label>
              <div className="flex items-center gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border/60 bg-muted">
                  {draft.image_url ? <img src={draft.image_url} alt="" className="h-full w-full object-cover" /> : <span className="font-mono text-[10px] uppercase text-muted-foreground">None</span>}
                </div>
                <div className="flex-1">
                  <ImageUploader
                    urls={draft.image_url ? [draft.image_url] : []}
                    onChange={(next) => setDraft({ ...draft, image_url: next[0] ?? null })}
                  />
                </div>
              </div>
            </div>
            {editing && badgeOwners ? (
              <div className="mt-2">
                <Label className="mb-1 block text-xs">Owners · {badgeOwners.length}</Label>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-background/40 p-2 text-xs">
                  {badgeOwners.length === 0 ? <div className="text-muted-foreground">Nobody owns this badge yet.</div> :
                    badgeOwners.map((o) => (
                      <div key={o.user_id} className="flex items-center justify-between py-1">
                        <Link to="/u/$id" params={{ id: o.user_id }} className="truncate hover:underline">
                          {o.profiles?.display_name ?? o.user_id.slice(0, 8)}
                        </Link>
                        <span className="font-mono text-[10px] text-muted-foreground">{new Date(o.earned_at).toLocaleDateString("en-IN")}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={saveBadge}>{creating ? "Create" : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Per-user grants */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Grant to user</div>
            <span className="font-mono text-[10px] text-muted-foreground">{customers?.length ?? 0}</span>
          </div>
          <Input placeholder="Search users…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="mb-2 h-9" />
          <div className="max-h-[500px] space-y-1 overflow-y-auto">
            {(customers ?? []).slice(0, 100).map((c) => (
              <button
                key={c.user_id}
                onClick={() => setSelectedUser(c)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedUser?.user_id === c.user_id ? "bg-primary/15 text-primary" : "hover:bg-accent/40"}`}
              >
                <div className="truncate font-semibold">{c.display_name ?? c.email}</div>
                <div className="truncate text-[10px] text-muted-foreground">{c.email}</div>
              </button>
            ))}
            {(customers ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">No users match.</div>
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          {!selectedUser ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Select a user to manage their badges.</div>
          ) : (
            <>
              <div className="mb-4">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Managing badges for</div>
                <div className="text-lg font-black">{selectedUser.display_name ?? selectedUser.email}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{selectedUser.email}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(catalog ?? []).map((b) => {
                  const has = owned.has(b.code);
                  return (
                    <div key={b.code} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                          {b.image_url ? <img src={b.image_url} alt="" className="h-full w-full object-cover" /> : <span className="font-mono text-[9px] uppercase text-muted-foreground">{b.icon.slice(0, 2)}</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">{b.name}</div>
                          <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">{b.category}</div>
                        </div>
                      </div>
                      {has ? (
                        <Button size="sm" variant="outline" onClick={() => revoke.mutate(b.code)}>Revoke</Button>
                      ) : (
                        <Button size="sm" onClick={() => grant.mutate(b.code)}>Grant</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}


// ---------- Homepage Settings (premium CMS) ----------

const IMAGE_POSITIONS = [
  { v: "center",     label: "Center" },
  { v: "top",        label: "Top" },
  { v: "bottom",     label: "Bottom" },
  { v: "left",       label: "Left" },
  { v: "right",      label: "Right" },
  { v: "50% 30%",    label: "Upper center" },
  { v: "50% 70%",    label: "Lower center" },
];

function HomepageSettings({
  hero,
  busy,
  onSaveHero,
  legacy,
}: {
  hero: HomepageHeroConfig;
  busy: boolean;
  onSaveHero: (v: HomepageHeroConfig) => void;
  legacy: {
    line1: string;
    prefix: string;
    italic: string;
    suffix: string;
    onSave: (key: string, value: string) => void;
  };
}) {
  const [draft, setDraft] = useState<HomepageHeroConfig>(hero);
  useEffect(() => setDraft(hero), [hero]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(hero);
  const commit = (patch: Partial<HomepageHeroConfig>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onSaveHero(next);
  };
  const commitDraft = () => onSaveHero(draft);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-bold">Homepage hero</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Above-the-fold section on the storefront home page.</div>
            </div>
          </div>
          {dirty ? (
            <Button size="sm" onClick={commitDraft} disabled={busy}>
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save changes
            </Button>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">Saved</span>
          )}
        </div>

        <div className="p-5">
          <div className="relative aspect-[21/9] overflow-hidden rounded-2xl border border-border/60 bg-muted">
            {draft.bg_image_url ? (
              <img
                src={draft.bg_image_url}
                alt="Hero background"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: draft.image_position, transform: `scale(${draft.image_scale})` }}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-xs">Add a background image below</span>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-background" style={{ opacity: draft.overlay_opacity }} aria-hidden />
            {draft.car_image_url ? (
              <img src={draft.car_image_url} alt="Hero car" className="absolute inset-x-0 bottom-0 mx-auto h-3/4 w-auto object-contain" />
            ) : null}
            <div className="absolute inset-0 flex items-end p-6">
              <div className="max-w-lg">
                <div className="font-serif text-3xl font-black leading-tight text-foreground sm:text-4xl">
                  {legacy.line1 || "Small cars."}<br />
                  {legacy.prefix ? <>{legacy.prefix} </> : null}
                  <em className="italic text-primary">{legacy.italic || "Serious"}</em>{legacy.suffix ? <> {legacy.suffix}</> : null}
                </div>
                {draft.subtitle ? <p className="mt-2 text-sm text-muted-foreground">{draft.subtitle}</p> : null}
                {draft.cta_text ? (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
                    {draft.cta_text} <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-base font-bold">Media</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Drag &amp; drop images or paste a URL. Recommended 2400x1000 for backgrounds.</div>
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <ImageDropField
            label="Background image"
            hint="Full-width backdrop behind the headline."
            value={draft.bg_image_url}
            aspect="wide"
            disabled={busy}
            onChange={(url) => commit({ bg_image_url: url })}
          />
          <ImageDropField
            label="Car / product image"
            hint="Foreground hero subject. PNG with transparency looks best."
            value={draft.car_image_url}
            aspect="wide"
            disabled={busy}
            onChange={(url) => commit({ car_image_url: url })}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <SettingsIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-base font-bold">Layout &amp; overlay</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Fine-tune framing, zoom and darkening for legibility.</div>
          </div>
        </div>
        <div className="grid gap-6 p-5 md:grid-cols-3">
          <div>
            <Label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Image position</Label>
            <Select value={draft.image_position} onValueChange={(v) => commit({ image_position: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {IMAGE_POSITIONS.map((p) => (
                  <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Zoom</Label>
              <span className="font-mono text-[11px] text-muted-foreground">{Math.round(draft.image_scale * 100)}%</span>
            </div>
            <Slider
              min={80}
              max={200}
              step={5}
              value={[Math.round(draft.image_scale * 100)]}
              onValueChange={([v]) => setDraft({ ...draft, image_scale: v / 100 })}
              onValueCommit={([v]) => commit({ image_scale: v / 100 })}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Overlay darkness</Label>
              <span className="font-mono text-[11px] text-muted-foreground">{Math.round(draft.overlay_opacity * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={90}
              step={5}
              value={[Math.round(draft.overlay_opacity * 100)]}
              onValueChange={([v]) => setDraft({ ...draft, overlay_opacity: v / 100 })}
              onValueCommit={([v]) => commit({ overlay_opacity: v / 100 })}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <TypeIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-base font-bold">Headline &amp; call-to-action</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Two-line headline with an italic accent word plus the primary CTA.</div>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextRow label="Line 1" placeholder="Small cars." value={legacy.line1} disabled={busy}
              onSave={(v) => legacy.onSave("hero_line1", v)} />
            <TextRow label="Line 2 prefix" placeholder="(before italic)" value={legacy.prefix} disabled={busy}
              onSave={(v) => legacy.onSave("hero_line2_prefix", v)} />
            <TextRow label="Italic accent word" placeholder="Serious" value={legacy.italic} disabled={busy}
              onSave={(v) => legacy.onSave("hero_line2_italic", v)} />
            <TextRow label="Line 2 suffix" placeholder="metal." value={legacy.suffix} disabled={busy}
              onSave={(v) => legacy.onSave("hero_line2_suffix", v)} />
          </div>
          <div>
            <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Subtitle</Label>
            <Textarea
              rows={2}
              value={draft.subtitle}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              onBlur={() => { if (draft.subtitle !== hero.subtitle) commit({ subtitle: draft.subtitle }); }}
              placeholder="One short line to introduce the drop."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">CTA button text</Label>
              <Input
                value={draft.cta_text}
                onChange={(e) => setDraft({ ...draft, cta_text: e.target.value })}
                onBlur={() => { if (draft.cta_text !== hero.cta_text) commit({ cta_text: draft.cta_text }); }}
                placeholder="Enter the vault"
              />
            </div>
            <div>
              <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">CTA link</Label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={draft.cta_url}
                  onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })}
                  onBlur={() => { if (draft.cta_url !== hero.cta_url) commit({ cta_url: draft.cta_url }); }}
                  placeholder="/shop"
                />
              </div>
            </div>
          </div>
          {dirty ? (
            <div className="flex justify-end">
              <Button size="sm" onClick={commitDraft} disabled={busy}>
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save hero
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------- Notifications Workspace ----------

type PrefGroup = {
  title: string;
  description: string;
  Icon: typeof Bell;
  tone: string;
  bg: string;
  items: { key: keyof NotificationPrefs; label: string; hint: string }[];
};

const NOTIF_GROUPS: PrefGroup[] = [
  {
    title: "Auctions",
    description: "Live bidding, wins and outbid alerts.",
    Icon: Gavel,
    tone: "text-amber-400",
    bg: "bg-amber-500/10",
    items: [
      { key: "auction_started", label: "Auction started", hint: "When a new auction goes live." },
      { key: "auction_ending_soon", label: "Ending soon", hint: "Reminder in the last minutes before close." },
      { key: "auction_won", label: "Auction won", hint: "Confirmation to the winning bidder." },
      { key: "outbid", label: "Outbid", hint: "When someone tops the user's bid." },
    ],
  },
  {
    title: "Orders",
    description: "Purchase and fulfilment updates.",
    Icon: Package,
    tone: "text-emerald-400",
    bg: "bg-emerald-500/10",
    items: [
      { key: "order_confirmed", label: "Order confirmed", hint: "Immediately after checkout." },
      { key: "order_packed", label: "Order packed", hint: "When staff mark the order packed." },
      { key: "order_shipped", label: "Order shipped", hint: "With tracking, when available." },
      { key: "order_delivered", label: "Order delivered", hint: "Marked delivered by carrier or staff." },
    ],
  },
  {
    title: "Products & community",
    description: "New drops, staff messages and badges.",
    Icon: Sparkles,
    tone: "text-fuchsia-400",
    bg: "bg-fuchsia-500/10",
    items: [
      { key: "new_product_drop", label: "New product drop", hint: "When a new car is added to the shop." },
      { key: "staff_announcement", label: "Staff announcements", hint: "Notifications published from this panel." },
      { key: "badge_awarded", label: "Badge awarded", hint: "When the user earns a collector badge." },
    ],
  },
];

function NotificationsWorkspace({
  prefs,
  busy,
  onSavePrefs,
}: {
  prefs: NotificationPrefs;
  busy: boolean;
  onSavePrefs: (v: NotificationPrefs) => void;
}) {
  const toggle = (key: keyof NotificationPrefs, value: boolean) => onSavePrefs({ ...prefs, [key]: value });
  const enabledCount = Object.values(prefs).filter(Boolean).length;
  const total = Object.keys(prefs).length;

  return (
    <div className="space-y-6">
      <NotificationAnnouncementsAdmin />

      <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-bold">Notification triggers</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Global switches that decide which events generate an in-app notification.
              </div>
            </div>
          </div>
          <span className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {enabledCount} / {total} enabled
          </span>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-3">
          {NOTIF_GROUPS.map((group) => {
            const Icon = group.Icon;
            const groupOn = group.items.filter((i) => prefs[i.key]).length;
            return (
              <div key={group.title} className="flex flex-col rounded-xl border border-border/60 bg-background/40">
                <div className="flex items-start gap-3 border-b border-border/50 p-4">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${group.bg} ${group.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold">{group.title}</div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{groupOn}/{group.items.length}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <div className="divide-y divide-border/50">
                  {group.items.map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-background/60">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{item.label}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</div>
                      </div>
                      <Switch
                        checked={prefs[item.key]}
                        disabled={busy}
                        onCheckedChange={(v) => toggle(item.key, v)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
