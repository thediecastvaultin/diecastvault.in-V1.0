import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeChip } from "@/components/site/BadgeChip";
import { useUserBadges, useUserStats } from "@/hooks/use-collector";
import { formatINR } from "@/lib/collector";
import { Trophy, Gavel, Zap, Coins, Star, Heart, Package } from "lucide-react";
import { StatGrid } from "@/components/site/StatGrid";

export const Route = createFileRoute("/u/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Collector — The Diecast Vault` },
      { name: "description", content: "Public collector profile with rank, badges and stats." },
      { property: "og:title", content: `Collector profile` },
      { property: "og:description", content: `Public collector at The Diecast Vault (${params.id.slice(0, 8)}…)` },
    ],
  }),
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();

  const { data: profile } = useQuery({
    queryKey: ["public-profile", id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, avatar_url, created_at").eq("id", id).maybeSingle();
      return data;
    },
  });
  const { data: stats } = useUserStats(id);
  const { data: badges } = useUserBadges(id);
  

  const { data: recentWins } = useQuery({
    queryKey: ["public-wins", id],
    queryFn: async () => {
      const { data } = await supabase.from("auction_logs")
        .select("id, product_name, brand, series, image_url, winning_bid, ended_at")
        .eq("winner_user_id", id).order("ended_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  if (!profile) {
    return <SiteShell><div className="mx-auto max-w-2xl px-4 py-24 text-center text-muted-foreground">Loading collector…</div></SiteShell>;
  }

  const initials = (profile.display_name ?? "U").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-12">
        <header className="mb-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar className="h-20 w-20 border border-border/60">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-3xl font-black">{profile.display_name ?? "Unnamed collector"}</h1>
            </div>
            <p className="mt-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Member since {new Date(profile.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}
            </p>
          </div>
        </header>

        {stats ? <StatGrid stats={stats} /> : null}

        <section className="mt-10">
          <SectionHeader icon={Star} title="Badges" count={badges?.length ?? 0} />
          {(badges?.length ?? 0) === 0 ? (
            <EmptyBlock text="No badges earned yet." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {badges!.map((b) => <BadgeChip key={b.code} badge={b} showDate />)}
            </div>
          )}
        </section>

        <section className="mt-10">
          <SectionHeader icon={Trophy} title="Recent wins" count={recentWins?.length ?? 0} />
          {(recentWins?.length ?? 0) === 0 ? (
            <EmptyBlock text="No auction wins yet." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentWins!.map((w) => (
                <div key={w.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
                    {w.image_url ? <img src={w.image_url} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{w.product_name}</div>
                    <div className="truncate text-xs text-muted-foreground">{[w.brand, w.series].filter(Boolean).join(" · ")}</div>
                    <div className="mt-1 font-mono text-xs font-bold text-primary">₹{(w.winning_bid ?? 0).toLocaleString("en-IN")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

    </SiteShell>
  );
}

function SectionHeader({ icon: Icon, title, count }: { icon: any; title: string; count: number }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="font-bold uppercase tracking-widest">{title}</h2>
      <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">{count}</span>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
