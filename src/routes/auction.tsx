import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/use-confirm";
import { toast } from "sonner";
import {
  ArrowRight,
  Expand,
  Send,
  Smile,
  Trophy,
  Users,
  AlertTriangle,
  MessageSquare,
  Radio,
  Play,
  Pause,
  Square,
  LogIn,
  RotateCcw,
  Eraser,
} from "lucide-react";
import heroCar from "@/assets/skyline-hero.jpg.asset.json";

export const Route = createFileRoute("/auction")({
  head: () => ({
    meta: [
      { title: "Live Auction — The Diecast Vault" },
      { name: "description", content: "Bid live on rare Hot Wheels die-cast cars. Real-time auctions with countdown timer and live feed." },
      { property: "og:title", content: "Live Auction — The Diecast Vault" },
      { property: "og:description", content: "Bid live on rare Hot Wheels die-cast cars." },
    ],
  }),
  component: AuctionPage,
});

type AuctionStatus = "published" | "live" | "paused" | "closed";

type ActiveAuction = {
  productName: string;
  brand: string;
  series: string;
  scale: string;
  description: string;
  images: string[];
  startingBid: number;
  minIncrement: number;
  rules: string;
  status?: AuctionStatus;
  startedAt?: string | null;
  publishedAt?: string | null;
  sessionId?: string | null;
  expiresAt?: string | null;
  closedAt?: string | null;
};

type FeedItem =
  | { kind: "bid"; time: string; user: string; color: string; amount: number }
  | { kind: "msg"; time: string; user: string; color: string; text: string }
  | { kind: "system"; time: string; text: string; tone?: "info" | "warn" | "success" };

type EventRow = {
  id: string;
  session_id: string;
  user_id: string | null;
  display_name: string;
  color: string;
  kind: "bid" | "msg" | "system";
  text: string | null;
  amount: number | null;
  tone: string | null;
  created_at: string;
};

const PALETTE = ["bg-blue-500/80", "bg-emerald-500/80", "bg-violet-500/80", "bg-orange-500/80", "bg-pink-500/80", "bg-sky-500/80"];
const TIMER_SECONDS = 15;

function fmtTime(d = new Date()) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function AuctionPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [active, setActive] = useState(0);
  const [bid, setBid] = useState("");
  const [message, setMessage] = useState("");
  const [joined, setJoined] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Presence-derived participants (user_id -> display_name)
  const [presenceUsers, setPresenceUsers] = useState<Record<string, string>>({});
  // Ticking clock for timer display
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const { data: liveAuction } = useQuery({
    queryKey: ["active_auction"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "active_auction").maybeSingle();
      return (data?.value as ActiveAuction | null) ?? null;
    },
  });

  // Current user's profile display name — used everywhere we author events
  const { data: myProfile } = useQuery({
    queryKey: ["auction-my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: isStaff } = useQuery({
    queryKey: ["auction-is-staff", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [a, s] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user!.id, _role: "staff" }),
      ]);
      return !!a.data || !!s.data;
    },
  });

  const status: AuctionStatus = liveAuction?.status ?? (liveAuction ? "published" : "published");
  const isLive = status === "live";
  const isPaused = status === "paused";
  const isClosed = status === "closed";
  const title = liveAuction?.productName || "No auction published";
  const subtitleParts = liveAuction
    ? [liveAuction.brand, liveAuction.series, liveAuction.scale].filter(Boolean)
    : [];
  const images = liveAuction && liveAuction.images.length > 0 ? liveAuction.images : [heroCar.url];
  const startingBid = liveAuction?.startingBid ?? 0;
  const minIncrement = liveAuction?.minIncrement ?? 10;
  const rules = liveAuction?.rules ?? "";
  const sessionId = liveAuction?.sessionId ?? null;
  const expiresAt = liveAuction?.expiresAt ?? null;

  // Reset the client's "joined" flag whenever the session changes
  useEffect(() => {
    setJoined(false);
    setBid("");
    setMessage("");
  }, [sessionId]);

  // Realtime: react to any change on site_settings (status, expiresAt, sessionId, ...)
  useEffect(() => {
    const ch = supabase
      .channel("auction-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings", filter: "key=eq.active_auction" },
        () => qc.invalidateQueries({ queryKey: ["active_auction"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  // Events for the current session
  const { data: events = [] } = useQuery<EventRow[]>({
    queryKey: ["auction_events", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_events")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  // Realtime: append newly inserted events for this session
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`auction-events-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "auction_events", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as EventRow;
          qc.setQueryData<EventRow[]>(["auction_events", sessionId], (prev = []) => {
            if (prev.some((e) => e.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, qc]);

  // Presence: track this user in the auction room. Never post a "left" message —
  // participant count simply decreases when a client disconnects.
  useEffect(() => {
    if (!sessionId || !user) return;
    const name =
      myProfile?.display_name ||
      (user.user_metadata?.display_name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined) ||
      "User";
    const ch = supabase.channel(`auction-presence-${sessionId}`, {
      config: { presence: { key: user.id } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, Array<{ display_name?: string }>>;
      const users: Record<string, string> = {};
      for (const [uid, metas] of Object.entries(state)) {
        users[uid] = metas[0]?.display_name ?? "User";
      }
      setPresenceUsers(users);
    });
    ch.subscribe(async (statusStr) => {
      if (statusStr === "SUBSCRIBED") {
        await ch.track({ display_name: name, user_id: user.id });
      }
    });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, user, myProfile?.display_name]);

  // Derived state ------------------------------------------------
  const feed: FeedItem[] = useMemo(
    () =>
      events.map((e): FeedItem => {
        const time = fmtTime(new Date(e.created_at));
        if (e.kind === "bid") return { kind: "bid", time, user: e.display_name, color: e.color, amount: e.amount ?? 0 };
        if (e.kind === "msg") return { kind: "msg", time, user: e.display_name, color: e.color, text: e.text ?? "" };
        return {
          kind: "system",
          time,
          text: e.text ?? "",
          tone: (e.tone as "info" | "warn" | "success" | undefined) ?? "info",
        };
      }),
    [events],
  );

  const bids = useMemo(
    () =>
      events
        .filter((e) => e.kind === "bid" && typeof e.amount === "number")
        .map((e) => ({ user: e.display_name, color: e.color, amount: e.amount as number })),
    [events],
  );

  const highest = useMemo(
    () => (bids.length ? [...bids].sort((a, b) => b.amount - a.amount)[0] : null),
    [bids],
  );

  // Timer derived from server-side expiresAt
  const seconds: number | null = useMemo(() => {
    if (!isLive || !expiresAt) return null;
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - nowMs) / 1000));
  }, [expiresAt, nowMs, isLive]);
  const firstBidPlaced = bids.length > 0;
  // Timer expired but auction not yet finalized by staff
  const biddingEnded = isLive && firstBidPlaced && seconds !== null && seconds <= 0;
  // Bidding is disabled whenever closed, paused, or the timer has hit zero.
  const locked = isClosed || isPaused || biddingEnded;

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [feed.length]);

  const currentMinBid = highest ? highest.amount + minIncrement : startingBid;

  const progress = seconds === null ? 0 : (seconds / TIMER_SECONDS) * 100;
  const circumference = 2 * Math.PI * 46;
  const dashOffset = circumference * (1 - progress / 100);
  const timerRed = seconds !== null && seconds <= 3;

  const participantsCount = Object.keys(presenceUsers).length;

  // Staff actions
  type StaffAction = "start" | "pause" | "resume" | "restart" | "end" | "clear";
  const staffMutation = useMutation({
    mutationFn: async (action: StaffAction) => {
      if (!liveAuction) return;
      const nowIso = new Date().toISOString();
      const in15s = () => new Date(Date.now() + TIMER_SECONDS * 1000).toISOString();
      const currentSession = liveAuction.sessionId ?? null;

      if (action === "end") {
        const { error } = await supabase.rpc("finalize_active_auction");
        if (error) throw error;
        // Post winner-announced message so it appears in the feed.
        const sid = currentSession;
        if (sid) {
          const top = bids.length ? [...bids].sort((a, b) => b.amount - a.amount)[0] : null;
          await supabase.from("auction_events").insert({
            session_id: sid,
            user_id: user!.id,
            display_name: "System",
            color: "bg-violet-500/80",
            kind: "system",
            text: top ? `Winner Announced: ${top.user} at ₹${top.amount.toLocaleString()}` : "Auction Ended. No bids placed.",
            tone: "success",
          });
        }
        return;
      }

      if (action === "clear") {
        const { error } = await supabase.rpc("clear_active_auction");
        if (error) throw error;
        return;
      }

      // Build next payload for start/pause/resume/restart
      let next: ActiveAuction = { ...liveAuction };
      let systemText: string | null = null;
      if (action === "start") {
        next = {
          ...next,
          status: "live",
          startedAt: nowIso,
          sessionId:
            globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          expiresAt: null,
          closedAt: null,
        };
        systemText = "Auction Started";
      } else if (action === "pause") {
        next = { ...next, status: "paused" };
        systemText = "Auction Paused";
      } else if (action === "resume") {
        // Resume from paused OR from bidding-ended → live, reset countdown to 15s
        // if any bid has been placed, otherwise leave expiresAt null.
        next = {
          ...next,
          status: "live",
          expiresAt: firstBidPlaced ? in15s() : null,
        };
        systemText = "Auction Resumed";
      } else if (action === "restart") {
        next = { ...next, status: "live", expiresAt: in15s() };
        systemText = "Timer Restarted";
      }

      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "active_auction", value: next as unknown as never, updated_at: nowIso }, { onConflict: "key" });
      if (error) throw error;

      const sid = next.sessionId ?? currentSession;
      if (sid && systemText && user) {
        await supabase.from("auction_events").insert({
          session_id: sid,
          user_id: user.id,
          display_name: "System",
          color: "bg-violet-500/80",
          kind: "system",
          text: systemText,
          tone: action === "pause" ? "warn" : "success",
        });
      }
    },
    onSuccess: (_d, action) => {
      qc.invalidateQueries({ queryKey: ["active_auction"] });
      qc.invalidateQueries({ queryKey: ["auction-settings"] });
      qc.invalidateQueries({ queryKey: ["auction-logs"] });
      const map: Record<StaffAction, string> = {
        start: "Auction started",
        pause: "Auction paused",
        resume: "Auction resumed",
        restart: "Timer restarted",
        end: "Auction ended",
        clear: "Auction data cleared",
      };
      toast.success(map[action]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function runStaff(action: StaffAction) {
    const confirmations: Partial<Record<StaffAction, { title: string; description: string; confirmText: string; destructive?: boolean }>> = {
      end: { title: "End auction?", description: "Declare the current highest bidder as the winner and archive to Auction Logs. This can't be undone.", confirmText: "End auction", destructive: true },
      resume: { title: "Resume auction?", description: "Bidding and chat will re-enable and the countdown resets to 15 seconds.", confirmText: "Resume" },
      restart: { title: "Restart timer?", description: "Countdown resets to 15 seconds. Highest bid and bid history stay the same.", confirmText: "Restart timer" },
      clear: { title: "Clear auction data?", description: "This wipes chat, bids, participants and the active session. Auction Logs and Drafts are not affected.", confirmText: "Clear data", destructive: true },
    };
    const cfg = confirmations[action];
    if (cfg) {
      const ok = await confirm(cfg);
      if (!ok) return;
    }
    staffMutation.mutate(action);
  }

  function displayName() {
    return (
      myProfile?.display_name ||
      (user?.user_metadata?.display_name as string | undefined) ||
      (user?.user_metadata?.full_name as string | undefined) ||
      "User"
    );
  }
  function colorFor(name: string) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  async function placeBid() {
    if (!isLive || locked) return;
    if (!joined) {
      toast.error("Join the auction first");
      return;
    }
    if (!user || !sessionId) return;
    const n = Number(bid);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a valid bid");
    if (n < currentMinBid) return toast.error(`Bid must be at least ₹${currentMinBid.toLocaleString()}`);
    if ((n - startingBid) % minIncrement !== 0) return toast.error(`Bid must be in multiples of ₹${minIncrement}`);
    const name = displayName();
    const color = colorFor(name);
    setBid("");
    const { error } = await supabase.from("auction_events").insert({
      session_id: sessionId,
      user_id: user.id,
      display_name: name,
      color,
      kind: "bid",
      amount: n,
    });
    if (error) {
      toast.error(error.message);
      setBid(String(n));
      return;
    }
    // If this is the very first bid and expiresAt is still null, seed it so the timer starts.
    if (!expiresAt) {
      await supabase
        .from("site_settings")
        .update({
          value: { ...(liveAuction as ActiveAuction), expiresAt: new Date(Date.now() + TIMER_SECONDS * 1000).toISOString() } as unknown as never,
          updated_at: new Date().toISOString(),
        })
        .eq("key", "active_auction");
    }
  }

  async function sendMessage() {
    if (!isLive || locked || !message.trim()) return;
    if (!joined) {
      toast.error("Join the auction first");
      return;
    }
    if (!user || !sessionId) return;
    const name = displayName();
    const text = message.trim();
    setMessage("");
    const { error } = await supabase.from("auction_events").insert({
      session_id: sessionId,
      user_id: user.id,
      display_name: name,
      color: colorFor(name),
      kind: "msg",
      text,
    });
    if (error) toast.error(error.message);
  }

  async function joinAuction() {
    if (!isLive) return;
    if (!user) {
      toast.error("Sign in to join the auction");
      return;
    }
    if (!sessionId) return;
    setJoined(true);
    const name = displayName();
    await supabase.from("auction_events").insert({
      session_id: sessionId,
      user_id: user.id,
      display_name: "System",
      color: "bg-violet-500/80",
      kind: "system",
      text: `${name} joined the auction`,
      tone: "info",
    });
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Staff controls */}
        {isStaff && liveAuction ? (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Staff Controls</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Status: {biddingEnded ? "bidding ended" : status}</div>
            <div className="ml-auto flex flex-wrap gap-2">
              {/* Before auction starts */}
              {!isLive && !isPaused && !isClosed ? (
                <Button size="sm" onClick={() => runStaff("start")} disabled={staffMutation.isPending} className="gap-2">
                  <Play className="h-3.5 w-3.5" /> Start Auction
                </Button>
              ) : null}

              {/* While live and still accepting bids */}
              {isLive && !biddingEnded ? (
                <Button size="sm" variant="outline" onClick={() => runStaff("pause")} disabled={staffMutation.isPending} className="gap-2">
                  <Pause className="h-3.5 w-3.5" /> Pause Auction
                </Button>
              ) : null}

              {/* While paused */}
              {isPaused ? (
                <Button size="sm" onClick={() => runStaff("resume")} disabled={staffMutation.isPending} className="gap-2">
                  <Play className="h-3.5 w-3.5" /> Resume Auction
                </Button>
              ) : null}

              {/* Bidding ended (live, timer=0) — extra controls */}
              {biddingEnded ? (
                <>
                  <Button size="sm" onClick={() => runStaff("resume")} disabled={staffMutation.isPending} className="gap-2">
                    <Play className="h-3.5 w-3.5" /> Resume Auction
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runStaff("restart")} disabled={staffMutation.isPending} className="gap-2">
                    <RotateCcw className="h-3.5 w-3.5" /> Restart Timer
                  </Button>
                </>
              ) : null}

              {/* End Auction — available while live or paused */}
              {(isLive || isPaused) ? (
                <Button size="sm" variant="outline" onClick={() => runStaff("end")} disabled={staffMutation.isPending} className="gap-2 text-destructive hover:text-destructive">
                  <Square className="h-3.5 w-3.5" /> End Auction
                </Button>
              ) : null}

              {/* Clear Auction Data — always available for staff */}
              {liveAuction ? (
                <Button size="sm" variant="outline" onClick={() => runStaff("clear")} disabled={staffMutation.isPending} className="gap-2 text-destructive hover:text-destructive">
                  <Eraser className="h-3.5 w-3.5" /> Clear Auction Data
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {confirmDialog}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.95fr)]">
          {/* LEFT */}
          <section>
            <div className="mb-3 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">
              <span className="relative flex h-2 w-2">
                {isLive ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" /> : null}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${isLive ? "bg-red-500" : "bg-muted-foreground"}`} />
              </span>
              {isLive ? "Live Auction" : isPaused ? "Paused" : isClosed ? "Closed" : "Upcoming Auction"}
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tight md:text-5xl">{title}</h1>
            {subtitleParts.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {subtitleParts.map((s, i) => (
                  <span key={i} className="flex items-center gap-3">
                    {i > 0 ? <span className="text-border">•</span> : null}
                    <span>{s}</span>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-6 grid grid-cols-[80px_1fr] gap-4">
              <div className="flex flex-col gap-3">
                {images.slice(0, 4).map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`relative aspect-square overflow-hidden rounded-lg border transition ${
                      active === i ? "border-primary/80 ring-1 ring-primary/40" : "border-border/60 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={src} alt={`View ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-border/60 bg-card/40">
                <img src={images[active] ?? images[0]} alt="Product" className="h-full w-full object-cover" />
                <button className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background/70 text-foreground backdrop-blur transition hover:bg-background">
                  <Expand className="h-4 w-4" />
                </button>
              </div>
            </div>

            {liveAuction?.description ? (
              <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-5">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Description</div>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">{liveAuction.description}</p>
              </div>
            ) : null}

            {rules ? (
              <div className="mt-4 rounded-2xl border border-border/60 bg-card/40 p-5">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Auction Rules</div>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">{rules}</p>
              </div>
            ) : null}

            {/* Place bid strip — visible while live (disabled during bidding-ended pending finalize) */}
            {isLive ? (
              <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Place Your Bid</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Minimum increment: ₹{minIncrement} <span className="mx-2 text-border">•</span> Bid in multiples of ₹{minIncrement}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    Current minimum bid
                    <span className="rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-foreground">₹{currentMinBid.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">₹</span>
                    <Input
                      value={bid}
                      onChange={(e) => setBid(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && placeBid()}
                      placeholder={`Enter your bid (min ₹${currentMinBid})`}
                      className="h-14 rounded-xl border-border/60 bg-background pl-9 text-base"
                      disabled={locked || !joined}
                    />
                  </div>
                  <Button size="lg" onClick={placeBid} disabled={locked || !joined} className="h-14 gap-2 rounded-xl px-8 text-sm font-bold uppercase tracking-widest">
                    Place Bid <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                {!joined ? (
                  <p className="mt-3 text-xs text-muted-foreground">Join the auction to place a bid.</p>
                ) : biddingEnded ? (
                  <p className="mt-3 text-xs text-red-500">Bidding has ended. Waiting for staff to finalize the auction.</p>
                ) : locked ? (
                  <p className="mt-3 text-xs text-red-500">Bidding is currently disabled.</p>
                ) : (
                  <p className="mt-3 text-xs text-emerald-500">✓ Multiples of ₹{minIncrement} • Minimum ₹{currentMinBid.toLocaleString()}</p>
                )}
              </div>
            ) : null}
          </section>

          {/* CENTER */}
          <section className="flex flex-col gap-4">
            {!isLive && !isClosed ? (
              <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-background">
                  <Radio className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-4 text-lg font-bold">
                  {isPaused ? "Auction paused." : "Auction has not started yet."}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please wait for the host to start the auction.
                </p>
                <Button disabled className="mt-5 gap-2">
                  <LogIn className="h-4 w-4" /> Join Auction
                </Button>
              </div>
            ) : (
              <>
                {/* Timer — only after first bid; keep visible frozen at 0 while awaiting finalize/closed */}
                {firstBidPlaced && (isLive || isClosed) ? (
                  <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
                    <div className="flex items-center gap-6">
                      <div className="relative h-32 w-32 shrink-0">
                        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                          <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                          <circle
                            cx="50"
                            cy="50"
                            r="46"
                            fill="none"
                            stroke={timerRed ? "#ef4444" : "hsl(var(--primary))"}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            style={{ transition: "stroke-dashoffset 1s linear" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className={`font-mono text-3xl font-black tabular-nums ${timerRed ? "text-red-500" : "text-foreground"}`}>
                            {String(Math.max(seconds ?? 0, 0)).padStart(2, "0")}
                          </div>
                          <div className={`font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${timerRed ? "text-red-500/80" : "text-muted-foreground"}`}>Sec</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">
                          {isClosed ? "Final timer" : biddingEnded ? "Bidding ended" : "Time to lock bid"}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {isClosed
                            ? "Auction has been finalized."
                            : biddingEnded
                            ? "Waiting for staff to finalize the auction."
                            : `Every new bid resets the timer to ${TIMER_SECONDS} seconds.`}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : isLive ? (
                  <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
                    {!joined ? (
                      <div className="text-center">
                        <div className="text-lg font-bold">Ready to bid?</div>
                        <p className="mt-1 text-sm text-muted-foreground">Join the auction to place the opening bid.</p>
                        <Button onClick={joinAuction} className="mt-4 gap-2">
                          <LogIn className="h-4 w-4" /> Join Auction
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-lg font-bold">Waiting for the first bid</div>
                        <p className="mt-1 text-sm text-muted-foreground">The timer starts as soon as the opening bid is placed.</p>
                      </div>
                    )}
                  </div>
                ) : null}

                {isClosed ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-emerald-300">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]">Auction Closed</div>
                    <p className="mt-1 text-sm">
                      {highest ? `Winner: ${highest.user} at ₹${highest.amount.toLocaleString()}.` : "Auction ended with no bids."}
                    </p>
                  </div>
                ) : null}

                {biddingEnded ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-yellow-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Bidding has ended. Waiting for staff to finalize the auction.</span>
                  </div>
                ) : null}

                {timerRed && seconds !== null && seconds > 0 ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">{seconds}s left to lock bid!</span>
                  </div>
                ) : null}

                {/* Highest bid / winner — after first bid, visible while live/closed */}
                {firstBidPlaced ? (
                  <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
                    <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                      <Trophy className="h-3.5 w-3.5 text-yellow-500" /> {isClosed ? "Winner" : "Current Highest Bid"}
                    </div>
                    <div className="mt-3 text-3xl font-black">{highest!.user}</div>
                    <div className="mt-1 text-4xl font-black text-emerald-500 tabular-nums">₹{highest!.amount.toLocaleString()}</div>
                    <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{bids.length} Bids so far</span>
                      <span className="text-border">•</span>
                      <span>{participantsCount} Participants</span>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-border/60 bg-card/40 p-5 text-center">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Starting Bid</div>
                    <div className="mt-2 text-2xl font-black tabular-nums">₹{startingBid.toLocaleString()}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card/40 p-5 text-center">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Minimum Increment</div>
                    <div className="mt-2 text-2xl font-black tabular-nums">₹{minIncrement.toLocaleString()}</div>
                  </div>
                </div>
              </>
            )}

            {!isLive && !isClosed ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border/60 bg-card/40 p-5 text-center">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Starting Bid</div>
                  <div className="mt-2 text-2xl font-black tabular-nums">₹{startingBid.toLocaleString()}</div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/40 p-5 text-center">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Minimum Increment</div>
                  <div className="mt-2 text-2xl font-black tabular-nums">₹{minIncrement.toLocaleString()}</div>
                </div>
              </div>
            ) : null}
          </section>

          {/* RIGHT — Live Feed */}
          <section className="flex h-[calc(100vh-6rem)] min-h-[600px] flex-col rounded-2xl border border-border/60 bg-card/40">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]">Live Auction Feed</div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                <Users className="h-3 w-3" /> {participantsCount}
              </div>
            </div>

            <div ref={feedRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {feed.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <p className="text-xs text-muted-foreground">
                    {isLive ? "No messages yet." : isClosed ? "No chat messages." : "Chat opens when the auction starts."}
                  </p>
                </div>
              ) : (
                feed.map((item, i) => <FeedRow key={i} item={item} />)
              )}
            </div>

            <div className="border-t border-border/60 p-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder={isLive && !biddingEnded ? "Type a message..." : isClosed ? "Chat is read-only" : biddingEnded ? "Chat is read-only" : "Chat disabled"}
                    className="h-11 rounded-xl border-border/60 bg-background pr-10"
                    disabled={!isLive || !joined || biddingEnded}
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <Smile className="h-4 w-4" />
                  </button>
                </div>
                <Button onClick={sendMessage} disabled={!isLive || !joined || biddingEnded} className="h-11 gap-2 rounded-xl px-5 font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
                  <Send className="h-3.5 w-3.5" /> Send
                </Button>
              </div>
              <p className="mt-2 px-1 text-[11px] text-muted-foreground">Be respectful. No spam.</p>
            </div>
          </section>
        </div>
      </div>
    </SiteShell>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  if (item.kind === "system") {
    const tone =
      item.tone === "warn" ? "text-yellow-400" : item.tone === "success" ? "text-emerald-400" : "text-sky-400";
    const Icon = item.tone === "warn" ? AlertTriangle : item.tone === "success" ? Radio : MessageSquare;
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
        <div className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card ${tone}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{item.time}</span>
            <span className="rounded-sm bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-300">SYSTEM</span>
          </div>
          <div className={`mt-1 text-sm ${tone}`}>{item.text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
      <div className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.color} text-[10px] font-bold text-white`}>
        {item.user.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>{item.time}</span>
          <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">{item.user}</span>
          {item.kind === "bid" ? (
            <span className="ml-auto font-mono text-[11px] font-bold text-emerald-400">₹{item.amount.toLocaleString()}</span>
          ) : null}
        </div>
        {item.kind === "msg" ? <div className="mt-1 text-sm text-foreground/90">{item.text}</div> : null}
      </div>
    </div>
  );
}