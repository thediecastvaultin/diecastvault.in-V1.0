import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  User as UserIcon, Package, ShieldCheck, MapPin, LogOut, ShoppingBag,
  LayoutDashboard, Gavel, Trophy, Award, BarChart3, Settings as SettingsIcon,
  Share2, ExternalLink,
} from "lucide-react";
import { BadgeChip } from "@/components/site/BadgeChip";
import { StatGrid } from "@/components/site/StatGrid";
import { useUserBadges, useUserStats } from "@/hooks/use-collector";
import { isValidIndianPhone, normalizeIndianPhone } from "@/lib/phone";

const TABS = ["overview", "wins", "badges", "stats", "settings"] as const;
type TabKey = (typeof TABS)[number];
const FOCUS_KEYS = ["name", "phone", "address"] as const;
type FocusKey = (typeof FOCUS_KEYS)[number];

const searchSchema = z.object({
  tab: z.enum(TABS).optional(),
  focus: z.enum(FOCUS_KEYS).optional(),
});

export const Route = createFileRoute("/account")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "My Account — The Diecast Vault" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const tab: TabKey = search.tab ?? "overview";
  const focus = search.focus;

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [loading, user, navigate]);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [hasDefaultAddress, setHasDefaultAddress] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const [{ data: profile }, { data: role }, { count }, { data: addr }] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url, phone").eq("id", user.id).maybeSingle(),
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("addresses").select("id").eq("user_id", user.id).eq("is_default", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setPhone(((profile as { phone?: string | null }).phone) ?? "");
    }
    setIsAdmin(Boolean(role));
    setOrderCount(count ?? 0);
    setHasDefaultAddress(Boolean(addr));
  }, [user]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const { data: stats } = useUserStats(user?.id);
  const { data: badges } = useUserBadges(user?.id);

  const setTab = useCallback((next: TabKey, focusNext?: FocusKey) => {
    navigate({ to: "/account", search: { tab: next, focus: focusNext }, replace: true });
  }, [navigate]);

  if (loading || !user) {
    return <SiteShell><div className="mx-auto max-w-2xl px-4 py-24 text-center text-muted-foreground">Loading…</div></SiteShell>;
  }

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/u/${user.id}`;

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-12">
        <header className="mb-8 flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-card">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserIcon className="h-7 w-7 text-muted-foreground" />}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black">{displayName || user.email?.split("@")[0]}</h1>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" /> Admin
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-2 rounded-full">
            <Link to="/u/$id" params={{ id: user.id }}><ExternalLink className="h-3.5 w-3.5" /> Public profile</Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Public profile link copied"); }}>
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="flex w-full flex-wrap gap-1">
            <TabsTrigger value="overview" className="flex-1 min-w-[110px]"><UserIcon className="mr-1.5 h-3.5 w-3.5" />Overview</TabsTrigger>
            <TabsTrigger value="wins"     className="flex-1 min-w-[110px]"><Trophy    className="mr-1.5 h-3.5 w-3.5" />Auction Wins</TabsTrigger>
            <TabsTrigger value="badges"   className="flex-1 min-w-[110px]"><Award     className="mr-1.5 h-3.5 w-3.5" />Badges</TabsTrigger>
            <TabsTrigger value="stats"    className="flex-1 min-w-[110px]"><BarChart3 className="mr-1.5 h-3.5 w-3.5" />Statistics</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 min-w-[110px]"><SettingsIcon className="mr-1.5 h-3.5 w-3.5" />Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            <ProfileCompletion
              displayName={displayName}
              phone={phone}
              hasDefaultAddress={hasDefaultAddress}
              onJump={(f) => setTab("settings", f)}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <QuickTile to="/orders" icon={Package} label="Orders" value={String(orderCount)} />
              <QuickTile to="/wishlist" icon={ShoppingBag} label="Wishlist" value="View" />
              <QuickTile to="/auction" icon={Gavel} label="Auction" value="Join" />
              {isAdmin ? <QuickTile to="/admin" icon={LayoutDashboard} label="Admin" value="Dashboard" /> : <QuickTile to="/shop" icon={ShoppingBag} label="Shop" value="Browse" />}
            </div>
            {stats ? <StatGrid stats={stats} /> : null}
          </TabsContent>

          <TabsContent value="wins" className="mt-6"><AuctionWins userId={user.id} /></TabsContent>

          <TabsContent value="badges" className="mt-6">
            {(badges?.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">No badges yet — join an auction or place a bid to start earning.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {badges!.map((b) => <BadgeChip key={b.code} badge={b} showDate />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stats" className="mt-6">{stats ? <StatGrid stats={stats} /> : <div className="text-sm text-muted-foreground">Loading…</div>}</TabsContent>



          <TabsContent value="settings" className="mt-6">
            <SettingsTab
              userId={user.id}
              email={user.email ?? ""}
              displayName={displayName}
              setDisplayName={setDisplayName}
              avatarUrl={avatarUrl}
              setAvatarUrl={setAvatarUrl}
              phone={phone}
              setPhone={setPhone}
              focus={tab === "settings" ? focus : undefined}
              onSaved={() => { void loadProfile(); }}
            />
          </TabsContent>
        </Tabs>
      </section>
    </SiteShell>
  );
}

function QuickTile({ to, icon: Icon, label, value }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Link to={to} className="group flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 hover:border-primary/60">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-black">{value}</div>
      </div>
      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
    </Link>
  );
}

function ProfileCompletion({ displayName, phone, hasDefaultAddress, onJump }: {
  displayName: string; phone: string; hasDefaultAddress: boolean; onJump: (focus: FocusKey) => void;
}) {
  const items: Array<{ key: FocusKey; label: string; done: boolean }> = [
    { key: "name", label: "Display Name", done: Boolean(displayName.trim()) },
    { key: "phone", label: "Phone Number", done: Boolean(phone.trim()) && isValidIndianPhone(phone) },
    { key: "address", label: "Default Shipping Address", done: hasDefaultAddress },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const missing = items.filter((i) => !i.done);
  if (missing.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-bold uppercase tracking-widest text-amber-500">Profile {pct}% complete</div>
          <p className="mt-1 text-sm text-muted-foreground">Complete your profile so we can reach you about orders and auction wins.</p>
        </div>
        <div className="min-w-[60px] text-right font-mono text-2xl font-black text-amber-500">{pct}%</div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {missing.map((m) => (
          <li key={m.key}>
            <button
              type="button"
              onClick={() => onJump(m.key)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-background px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-500/10"
            >
              Add {m.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsTab({ userId, email, displayName, setDisplayName, avatarUrl, setAvatarUrl, phone, setPhone, focus, onSaved }: {
  userId: string; email: string;
  displayName: string; setDisplayName: (v: string) => void;
  avatarUrl: string; setAvatarUrl: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  focus?: FocusKey;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const [savingProfile, setSavingProfile] = useState(false);
  const [addr, setAddr] = useState({ full_name: "", phone: "", line1: "", line2: "", city: "", state: "", postal_code: "", country: "India" });
  const [addrId, setAddrId] = useState<string | null>(null);
  const [savingAddr, setSavingAddr] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addrCardRef = useRef<HTMLDivElement>(null);
  const addrFirstRef = useRef<HTMLInputElement>(null);

  const loadAddress = useCallback(async () => {
    const { data: address } = await supabase.from("addresses").select("*").eq("user_id", userId).eq("is_default", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (address) {
      setAddrId(address.id);
      setAddr({
        full_name: address.full_name ?? "", phone: address.phone ?? "", line1: address.line1 ?? "", line2: address.line2 ?? "",
        city: address.city ?? "", state: address.state ?? "", postal_code: address.postal_code ?? "", country: address.country ?? "India",
      });
    } else {
      setAddrId(null);
    }
  }, [userId]);

  useEffect(() => { void loadAddress(); }, [loadAddress]);

  // Focus + scroll target when arriving from Profile Completion.
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      if (focus === "name") nameRef.current?.focus();
      else if (focus === "phone") phoneRef.current?.focus();
      else if (focus === "address") {
        addrCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        addrFirstRef.current?.focus();
      }
    }, 50);
    return () => clearTimeout(t);
  }, [focus]);

  async function saveProfile() {
    const trimmedPhone = phone.trim();
    if (trimmedPhone && !isValidIndianPhone(trimmedPhone)) {
      return toast.error("Enter a valid 10-digit Indian mobile number");
    }
    setSavingProfile(true);
    const normalizedPhone = trimmedPhone ? normalizeIndianPhone(trimmedPhone) : null;
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      phone: normalizedPhone,
    }).eq("id", userId);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    if (normalizedPhone) setPhone(normalizedPhone);
    toast.success("Profile updated");
    onSaved();
  }

  async function saveAddress() {
    if (!addr.full_name || !addr.line1 || !addr.city || !addr.postal_code) return toast.error("Fill name, address, city and PIN code");
    if (addr.phone && !isValidIndianPhone(addr.phone)) return toast.error("Enter a valid 10-digit Indian mobile number for the address");
    setSavingAddr(true);
    const normalizedAddrPhone = addr.phone ? normalizeIndianPhone(addr.phone) : "";
    const payload = {
      ...addr,
      phone: normalizedAddrPhone,
      user_id: userId,
      is_default: true,
    };
    // Unset any other defaults first so exactly one default remains.
    const { error: unsetErr } = await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true)
      .neq("id", addrId ?? "00000000-0000-0000-0000-000000000000");
    if (unsetErr) { setSavingAddr(false); return toast.error(unsetErr.message); }

    const { data: saved, error } = addrId
      ? await supabase.from("addresses").update(payload).eq("id", addrId).select("id").single()
      : await supabase.from("addresses").insert(payload).select("id").single();
    setSavingAddr(false);
    if (error) return toast.error(error.message);
    if (saved) setAddrId(saved.id);
    if (normalizedAddrPhone) setAddr((a) => ({ ...a, phone: normalizedAddrPhone }));
    toast.success("Default shipping address saved");
    onSaved();
  }

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-xl border border-border/60 bg-card p-6">
        <div className="mb-4 flex items-center gap-2"><UserIcon className="h-4 w-4 text-primary" /><h2 className="font-bold uppercase tracking-widest">Profile</h2></div>
        <div className="space-y-4">
          <div><Label htmlFor="dn" required>Display name</Label><Input id="dn" ref={nameRef} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1" placeholder="Your name" /></div>
          <div><Label>Email</Label><Input value={email} disabled className="mt-1" /></div>
          <div>
            <Label htmlFor="ph">Phone number</Label>
            <Input id="ph" ref={phoneRef} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="10-digit mobile e.g. 98765 43210" />
            <p className="mt-1 text-[11px] text-muted-foreground">Optional. Indian mobile numbers only. Used for order updates &amp; auction wins.</p>
          </div>
          <div><Label htmlFor="av">Avatar URL</Label><Input id="av" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="mt-1" placeholder="https://…" /></div>
          <Button onClick={saveProfile} disabled={savingProfile} className="w-full bg-primary hover:bg-primary/90">{savingProfile ? "Saving…" : "Save profile"}</Button>
        </div>
      </section>

      <section ref={addrCardRef} className="rounded-xl border border-border/60 bg-card p-6">
        <div className="mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><h2 className="font-bold uppercase tracking-widest">Default shipping address</h2></div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Input ref={addrFirstRef} placeholder="Full name" value={addr.full_name} onChange={(e) => setAddr({ ...addr, full_name: e.target.value })} /><Input placeholder="Phone (10-digit)" inputMode="numeric" maxLength={10} value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value.replace(/\D+/g, "").slice(0, 10) })} /></div>
          <Input placeholder="Address line 1" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
          <Input placeholder="Address line 2 (optional)" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
          <div className="grid grid-cols-2 gap-3"><Input placeholder="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /><Input placeholder="State" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><Input placeholder="PIN code" inputMode="numeric" maxLength={6} value={addr.postal_code} onChange={(e) => setAddr({ ...addr, postal_code: e.target.value.replace(/\D+/g, "").slice(0, 6) })} /><Input placeholder="Country" value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })} /></div>
          <Button onClick={saveAddress} disabled={savingAddr} className="w-full bg-primary hover:bg-primary/90">{savingAddr ? "Saving…" : addrId ? "Update address" : "Save address"}</Button>
        </div>
      </section>

      <div className="lg:col-span-2 flex flex-col items-center gap-3 pt-2 text-center">
        <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
        <p className="text-xs text-muted-foreground">Signed in as {email}</p>
      </div>
    </div>
  );
}

type AuctionWinRow = {
  id: string; product_name: string; brand: string | null; series: string | null; scale: string | null;
  image_url: string | null; winning_bid: number | null; ended_at: string;
};

function AuctionWins({ userId }: { userId: string }) {
  const { data: wins, isLoading } = useQuery({
    queryKey: ["my-auction-wins", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("auction_logs")
        .select("id, product_name, brand, series, scale, image_url, winning_bid, ended_at")
        .eq("winner_user_id", userId).order("ended_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AuctionWinRow[];
    },
  });

  const { data: winOrders } = useQuery({
    queryKey: ["my-win-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders")
        .select("id, auction_log_id, status").eq("user_id", userId).not("auction_log_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const orderByLog = new Map((winOrders ?? []).map((o) => [o.auction_log_id!, o]));

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if ((wins?.length ?? 0) === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
        <Gavel className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">You haven't won any auctions yet.</p>
        <Button asChild size="sm" className="mt-4 rounded-full"><Link to="/auction">Join the next auction</Link></Button>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {wins!.map((w) => {
        const order = orderByLog.get(w.id);
        const inner = (
          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/60">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">{w.image_url ? <img src={w.image_url} alt="" className="h-full w-full object-cover" /> : null}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{w.product_name}</div>
              <div className="truncate text-xs text-muted-foreground">{[w.brand, w.series, w.scale].filter(Boolean).join(" · ") || "—"}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">{w.winning_bid ? `₹${w.winning_bid.toLocaleString()}` : "—"}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(w.ended_at).toLocaleDateString("en-IN")}</span>
                {order ? <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest">{order.status}</span> : null}
              </div>
            </div>
          </div>
        );
        return order ? <Link key={w.id} to="/orders/$id" params={{ id: order.id }}>{inner}</Link> : <div key={w.id}>{inner}</div>;
      })}
    </div>
  );
}
