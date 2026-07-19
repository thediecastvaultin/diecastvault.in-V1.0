import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, RequiredMark } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { LogIn, Lock, Tag, X, Loader2, AlertTriangle, MapPin, Wallet, StickyNote, Receipt } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";

import { isValidIndianPhone, normalizeIndianPhone } from "@/lib/phone";
import { useSiteSettings } from "@/hooks/use-site-settings";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — The Diecast Vault" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

type FormState = {
  display_name: string;
  full_name: string;
  phone: string; // 10 digit local
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  country_code: string; // e.g. "+91"
  notes: string;
};

const EMPTY_FORM: FormState = {
  display_name: "",
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
  country_code: "+91",
  notes: "",
};

type FieldKey = keyof FormState;
type Errors = Partial<Record<FieldKey, string>>;

function CheckoutPage() {
  const { user, loading } = useAuth();
  const { shop } = useSiteSettings();
  const cart = useCart();
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirm();

  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [couponInput, setCouponInput] = useState("");

  const [coupon, setCoupon] = useState<{
    code: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    min_order_cents: number;
    max_discount_cents: number | null;
  } | null>(null);
  const [applying, setApplying] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const [defaultAddress, setDefaultAddress] = useState<null | FormState>(null);
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [profilePhone, setProfilePhone] = useState<string>("");
  const [profileDisplayName, setProfileDisplayName] = useState<string>("");
  const [stockIssues, setStockIssues] = useState<Array<{ productId: string; name: string; available: number; requested: number }>>([]);

  const loadProfileAndAddress = useCallback(async () => {
    if (!user) return;
    const [{ data: addr }, { data: prof }] = await Promise.all([
      supabase.from("addresses").select("*").eq("user_id", user.id).eq("is_default", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle(),
    ]);
    if (addr) {
      const normalized = normalizeIndianPhone(addr.phone ?? "");
      setDefaultAddress({
        display_name: (prof?.display_name ?? "").trim(),
        full_name: addr.full_name,
        phone: normalized || (addr.phone ?? ""),
        line1: addr.line1,
        line2: addr.line2 ?? "",
        city: addr.city,
        state: addr.state,
        postal_code: addr.postal_code,
        country: addr.country ?? "India",
        country_code: "+91",
        notes: "",
      });
    } else {
      setDefaultAddress(null);
    }
    setAddressLoaded(true);

    const p = (prof?.phone ?? "").trim();
    const dn = (prof?.display_name ?? "").trim();
    setProfilePhone(p);
    setProfileDisplayName(dn);
    setForm((f) => ({
      ...f,
      phone: f.phone || (p ? normalizeIndianPhone(p) : ""),
      display_name: f.display_name || dn,
      full_name: f.full_name || dn,
    }));
  }, [user]);

  useEffect(() => {
    void loadProfileAndAddress();
  }, [loadProfileAndAddress]);

  // Refresh default address when the tab regains focus (user may have edited it in another tab).
  useEffect(() => {
    if (!user) return;
    const onFocus = () => { void loadProfileAndAddress(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, loadProfileAndAddress]);

  function updateField<K extends FieldKey>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _drop, ...rest } = e;
      return rest;
    });
  }

  function useDefaultAddress() {
    if (!defaultAddress) return;
    setForm((f) => ({ ...defaultAddress, notes: f.notes }));
    setErrors({});
    toast.success("Default address applied");
  }

  const totals = useMemo(() => {
    const subtotal = cart.subtotalCents;
    let discount = 0;
    if (coupon && subtotal >= coupon.min_order_cents) {
      discount = coupon.discount_type === "percent"
        ? Math.round((subtotal * coupon.discount_value) / 100)
        : coupon.discount_value;
      if (coupon.max_discount_cents && coupon.max_discount_cents > 0) {
        discount = Math.min(discount, coupon.max_discount_cents);
      }
      discount = Math.min(discount, subtotal);
    }
    const afterDiscount = subtotal - discount;
    const shipping = afterDiscount >= shop.free_ship_threshold_cents || afterDiscount === 0 ? 0 : shop.shipping_cents;
    const tax = Math.round(afterDiscount * (shop.tax_percent / 100));
    const total = afterDiscount + shipping + tax;
    return { subtotal, discount, shipping, tax, total };
  }, [cart.subtotalCents, coupon, shop.free_ship_threshold_cents, shop.shipping_cents, shop.tax_percent]);

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setApplying(true);
    const { data, error } = await supabase.rpc("validate_coupon", {
      _code: code,
      _subtotal_cents: cart.subtotalCents,
    });
    setApplying(false);
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return toast.error("Invalid coupon");
    if (!row.valid) return toast.error(row.reason ?? "Invalid coupon");
    setCoupon({
      code: row.code,
      discount_type: row.discount_type as "percent" | "fixed",
      discount_value: row.discount_value,
      min_order_cents: row.min_order_cents,
      max_discount_cents: row.max_discount_cents ?? null,
    });
    toast.success(`Applied ${row.code}`);
  }

  function validateForm(): Errors {
    const e: Errors = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    else if (!isValidIndianPhone(form.phone)) e.phone = "Enter a valid 10-digit Indian mobile number";
    if (!form.line1.trim()) e.line1 = "Address line 1 is required";
    if (!form.city.trim()) e.city = "City is required";
    if (!form.state.trim()) e.state = "State is required";
    if (!form.postal_code.trim()) e.postal_code = "Postal code is required";
    else if (!/^\d{6}$/.test(form.postal_code.trim())) e.postal_code = "Enter a 6-digit postal code";
    if (!form.country.trim()) e.country = "Country is required";
    return e;
  }

  async function verifyStock(): Promise<boolean> {
    if (cart.items.length === 0) return false;
    const ids = cart.items.map((i) => i.productId);
    const { data, error } = await supabase.from("products").select("id, name, stock_quantity").in("id", ids);
    if (error) return true; // fail-open on network hiccups; DB check constraint still prevents negative stock
    const map = new Map((data ?? []).map((p) => [p.id, p]));
    const issues: typeof stockIssues = [];
    for (const it of cart.items) {
      const p = map.get(it.productId);
      const available = p?.stock_quantity ?? 0;
      if (!p || available < it.quantity) {
        issues.push({ productId: it.productId, name: p?.name ?? it.name, available, requested: it.quantity });
      }
    }
    setStockIssues(issues);
    return issues.length === 0;
  }

  if (loading) {
    return <SiteShell><div className="py-24 text-center text-sm text-muted-foreground">Loading…</div></SiteShell>;
  }

  if (!user) {
    return (
      <SiteShell>
        <section className="mx-auto max-w-md px-4 py-24 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-muted"><Lock className="h-5 w-5" /></div>
          <h1 className="mt-6 text-3xl font-black uppercase tracking-tight">Sign in to check out</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your cart is saved. Sign in to finish placing your order.</p>
          <Button asChild className="mt-6 rounded-full"><Link to="/auth"><LogIn className="mr-2 h-4 w-4" />Sign in</Link></Button>
        </section>
      </SiteShell>
    );
  }

  if (cart.hydrated && cart.items.length === 0) {
    return (
      <SiteShell>
        <section className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight">Your cart is empty</h1>
          <Button asChild className="mt-6 rounded-full"><Link to="/shop">Shop the vault</Link></Button>
        </section>
      </SiteShell>
    );
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (submitLock.current || submitting) return;

    // Field validation with focus + inline errors
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const order: FieldKey[] = ["full_name", "phone", "line1", "line2", "city", "state", "postal_code", "country"];
      const first = order.find((k) => errs[k]);
      if (first) fieldRefs.current[first]?.focus();
      toast.error("Please correct the highlighted fields");
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    const normalizedPhone = normalizeIndianPhone(form.phone);
    const countryCode = form.country_code || "+91";

    try {
      // Purchase-limit enforcement
      for (const it of cart.items) {
        const { data: check, error: checkErr } = await supabase.rpc("check_purchase_limit", {
          _product_id: it.productId,
          _requested_qty: it.quantity,
        });
        if (checkErr) continue;
        const row = Array.isArray(check) ? check[0] : check;
        if (row && row.allowed === false) {
          const remaining = Math.max(0, (row.limit_per_customer ?? 0) - (row.already_purchased ?? 0));
          toast.error(`Purchase limit reached for ${row.product_name || it.name}`, {
            description: `Limit is ${row.limit_per_customer} per customer. You've already purchased ${row.already_purchased}. You can add ${remaining} more.`,
            duration: 8000,
          });
          return;
        }
      }

      // Stock validation
      const stockOk = await verifyStock();
      if (!stockOk) {
        toast.error("Stock changed", { description: "Some items are no longer available in the requested quantity. Review your cart before continuing." });
        return;
      }

      // Offer to sync profile phone with the one used at checkout (in-app dialog, never native)
      const savedNormalized = profilePhone ? normalizeIndianPhone(profilePhone) : "";
      if (normalizedPhone !== savedNormalized) {
        const ok = await confirm({
          title: savedNormalized ? "Update saved phone number?" : "Save this phone number?",
          description: savedNormalized
            ? `Replace the phone on your profile with +91 ${normalizedPhone}?`
            : `Save +91 ${normalizedPhone} to your profile so future checkouts are faster.`,
          confirmText: savedNormalized ? "Update" : "Save",
          cancelText: "Not now",
        });
        if (ok) {
          const { error: profErr } = await supabase.from("profiles").update({ phone: normalizedPhone }).eq("id", user.id);
          if (!profErr) {
            setProfilePhone(normalizedPhone);
            toast.success("Profile phone updated");
          }
        }
      }


      // Note: we no longer auto-write the user's default address from checkout.
      // The saved default is owned by the Profile → Settings screen; writing here
      // caused duplicate rows and the "default address keeps changing" bug.

      // Order snapshot: keep display_name, name, email, phone (with country_code separately)
      const shippingSnapshot = {
        display_name: (form.display_name || profileDisplayName || "").trim(),
        full_name: form.full_name.trim(),
        phone: normalizedPhone,
        country_code: countryCode,
        phone_display: `${countryCode} ${normalizedPhone}`,
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        city: form.city.trim(),
        state: form.state.trim(),
        postal_code: form.postal_code.trim(),
        country: form.country.trim(),
      };

      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        user_id: user.id,
        status: "pending",
        payment_method: "cod",
        subtotal_cents: totals.subtotal,
        tax_cents: totals.tax,
        shipping_cents: totals.shipping,
        total_cents: totals.total,
        coupon_code: coupon?.code ?? null,
        discount_cents: totals.discount,
        shipping_address: shippingSnapshot,
        contact_email: user.email ?? "",
        notes: form.notes.trim() || null,
      }).select("id, order_number").single();
      if (orderErr) throw orderErr;

      const items = cart.items.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.name,
        product_series: i.series,
        product_image: i.image,
        quantity: i.quantity,
        unit_price_cents: i.unitPriceCents,
        line_total_cents: i.unitPriceCents * i.quantity,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      // Decrement stock (guarded by products_stock_quantity_check >= 0)
      for (const i of cart.items) {
        const { data: prod } = await supabase.from("products").select("stock_quantity").eq("id", i.productId).maybeSingle();
        if (prod && prod.stock_quantity >= i.quantity) {
          await supabase.from("products").update({ stock_quantity: prod.stock_quantity - i.quantity }).eq("id", i.productId);
        }
      }

      // Coupon usage
      if (coupon) {
        const { data: c } = await supabase.from("coupons").select("used_count").eq("code", coupon.code).maybeSingle();
        if (c) await supabase.from("coupons").update({ used_count: c.used_count + 1 }).eq("code", coupon.code);
        await supabase.from("coupon_redemptions").insert({
          coupon_code: coupon.code,
          user_id: user.id,
          order_id: order.id,
          discount_cents: totals.discount,
        });
      }

      cart.clear();
      toast.success(`Order ${order.order_number} placed`);
      navigate({ to: "/orders/$id", params: { id: order.id } });
    } catch (err) {
      console.error("[checkout] place order failed", err);
      const anyErr = err as { message?: string; details?: string; hint?: string; code?: string } | null;
      const parts = [anyErr?.message, anyErr?.details, anyErr?.hint, anyErr?.code ? `(code ${anyErr.code})` : null].filter(Boolean);
      toast.error("Failed to place order", { description: parts.length ? parts.join(" — ") : "Unknown error" });
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const registerRef = (key: FieldKey) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    fieldRefs.current[key] = el;
  };

  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ Checkout</div>
        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-4xl md:text-5xl">Complete your order</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Review your details, apply a coupon, and confirm your delivery.</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Lock className="h-3 w-3" /> Secure checkout · signed in as <span className="text-foreground/85">{user.email}</span>
        </div>

        {stockIssues.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" /> Stock changed
            </div>
            <ul className="mt-2 space-y-1 text-xs text-destructive">
              {stockIssues.map((s) => (
                <li key={s.productId}>{s.name} — requested {s.requested}, only {s.available} available</li>
              ))}
            </ul>
            <div className="mt-3">
              <Button asChild size="sm" variant="outline"><Link to="/shop">Review cart</Link></Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={placeOrder} noValidate className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-[1.4fr_1fr] lg:gap-8">
          <div className="space-y-6">
            <Section
              step="01"
              icon={<MapPin className="h-4 w-4" />}
              title="Shipping address"
              description="Where should we deliver your order?"
            >
              <div className="mb-5">
                {!addressLoaded ? (
                  <div className="h-11 animate-pulse rounded-xl bg-muted/40" />
                ) : defaultAddress ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                    <div className="text-xs text-muted-foreground">
                      Saved default: <span className="font-semibold text-foreground">{defaultAddress.full_name}</span> · {defaultAddress.city}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={useDefaultAddress}>Use Default Address</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/60 px-4 py-3">
                    <div className="text-xs text-muted-foreground">No default address saved yet — fill the fields below, or add one in your profile.</div>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link to="/account">Set Default Address</Link>
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                <Field label="Display name" error={errors.display_name}>
                  <Input value={form.display_name} onChange={(e) => updateField("display_name", e.target.value)} placeholder="How we greet you" />
                </Field>
                <Field label="Full name *" error={errors.full_name}>
                  <Input ref={registerRef("full_name")} value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} aria-invalid={!!errors.full_name} />
                </Field>
                <Field label="Phone *" error={errors.phone}>
                  <div className="flex gap-2">
                    <div className="inline-flex h-10 shrink-0 items-center rounded-md border border-input bg-muted px-3 font-mono text-sm text-muted-foreground">+91</div>
                    <Input
                      ref={registerRef("phone")}
                      inputMode="numeric"
                      maxLength={10}
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value.replace(/\D+/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      aria-invalid={!!errors.phone}
                    />
                  </div>
                </Field>
                <div className="hidden sm:block" />
                <div className="sm:col-span-2">
                  <Field label="Address line 1 *" error={errors.line1}>
                    <Input ref={registerRef("line1")} value={form.line1} onChange={(e) => updateField("line1", e.target.value)} aria-invalid={!!errors.line1} placeholder="House / flat, street" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Address line 2" error={errors.line2}>
                    <Input ref={registerRef("line2")} value={form.line2} onChange={(e) => updateField("line2", e.target.value)} placeholder="Landmark, area (optional)" />
                  </Field>
                </div>
                <Field label="City *" error={errors.city}>
                  <Input ref={registerRef("city")} value={form.city} onChange={(e) => updateField("city", e.target.value)} aria-invalid={!!errors.city} />
                </Field>
                <Field label="State *" error={errors.state}>
                  <Input ref={registerRef("state")} value={form.state} onChange={(e) => updateField("state", e.target.value)} aria-invalid={!!errors.state} />
                </Field>
                <Field label="Postal code *" error={errors.postal_code}>
                  <Input
                    ref={registerRef("postal_code")}
                    inputMode="numeric"
                    maxLength={6}
                    value={form.postal_code}
                    onChange={(e) => updateField("postal_code", e.target.value.replace(/\D+/g, "").slice(0, 6))}
                    aria-invalid={!!errors.postal_code}
                    placeholder="560001"
                  />
                </Field>
                <Field label="Country *" error={errors.country}>
                  <Input ref={registerRef("country")} value={form.country} onChange={(e) => updateField("country", e.target.value)} aria-invalid={!!errors.country} />
                </Field>
              </div>
            </Section>

            <Section
              step="02"
              icon={<Wallet className="h-4 w-4" />}
              title="Payment method"
              description="Choose how you'd like to pay for this order."
            >
              {shop.cod_enabled ? (
                <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-primary/60 bg-primary/5 p-4 ring-1 ring-primary/30">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-primary bg-background">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Cash on delivery</div>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">Selected</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Pay in cash when your order arrives. Estimated delivery: {shop.estimated_delivery_days}.</p>
                  </div>
                </label>
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Cash on delivery is currently unavailable. Please contact support to complete this order.
                </div>
              )}
            </Section>

            <Section
              step="03"
              icon={<StickyNote className="h-4 w-4" />}
              title="Order notes"
              description="Optional message for the packer or delivery team."
            >
              <Textarea rows={3} placeholder="Leave a note for the packer (optional)…" value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
            </Section>
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <div className="space-y-6 rounded-2xl border border-border/70 bg-card/60 p-6 shadow-[var(--shadow-card)]">
              <div>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" /> Order summary
                </div>
                <h2 className="mt-1 text-lg font-black uppercase tracking-tight">Your items</h2>
              </div>

              <ul className="divide-y divide-border/60">
                {cart.items.map((i) => (
                  <li key={i.productId} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover" /> : null}
                      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 font-mono text-[10px] text-background">{i.quantity}</span>
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="truncate font-semibold leading-tight">{i.name}</div>
                      <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{i.series}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{formatPrice(i.unitPriceCents)} × {i.quantity}</div>
                    </div>
                    <div className="whitespace-nowrap font-mono text-sm font-semibold">{formatPrice(i.unitPriceCents * i.quantity)}</div>
                  </li>
                ))}
              </ul>

              <div>
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" /> Coupon
                </div>
                {coupon ? (
                  <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">{coupon.code}</span>
                      <span className="text-muted-foreground">applied</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCoupon(null); setCouponInput(""); }}
                      className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Remove coupon"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyCoupon(); } }}
                      className="h-10 flex-1"
                    />
                    <Button type="button" variant="outline" onClick={applyCoupon} disabled={applying || !couponInput.trim()} className="h-10 shrink-0 px-4">
                      {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
                {totals.discount > 0 ? <Row label={`Discount (${coupon?.code})`} value={`− ${formatPrice(totals.discount)}`} accent /> : null}
                <Row label={`GST (${shop.tax_percent}%)`} value={formatPrice(totals.tax)} />
                <Row label="Shipping" value={totals.shipping === 0 ? "Free" : formatPrice(totals.shipping)} />
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Total</div>
                    <div className="text-[11px] text-muted-foreground">Incl. all taxes</div>
                  </div>
                  <span className="font-mono text-2xl font-black tracking-tight">{formatPrice(totals.total)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || stockIssues.length > 0}
                  className="h-12 w-full rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-primary/90 disabled:opacity-70"
                >
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing order…</>
                  ) : (
                    <>Place order · {formatPrice(totals.total)}</>
                  )}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> Signed in as {user.email}
                </p>
              </div>
            </div>
          </aside>
        </form>
      </section>
      {confirmDialog}
    </SiteShell>
  );
}

function Section({
  step,
  icon,
  title,
  description,
  children,
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-5 sm:p-6">
      <div className="flex items-start gap-3 border-b border-border/60 pb-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border/60 bg-background/60 text-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Step {step}</span>
          </div>
          <h2 className="text-lg font-black uppercase tracking-tight sm:text-xl">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="pt-5">{children}</div>
    </div>
  );
}


function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const required = label.trim().endsWith("*");
  const clean = required ? label.replace(/\s*\*\s*$/, "") : label;
  return (
    <div>
      <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {clean}
        {required ? <RequiredMark /> : null}
      </Label>
      {children}
      {error ? <p className="mt-1 text-[11px] font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${accent ? "text-primary font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

