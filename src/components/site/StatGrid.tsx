import type { UserStats } from "@/hooks/use-collector";
import { formatINR } from "@/lib/collector";
import { Gavel, Trophy, Zap, Coins, BarChart3, Award } from "lucide-react";

export function StatGrid({ stats }: { stats: UserStats }) {
  const items = [
    { icon: Gavel,   label: "Auctions Joined", value: stats.auctions_joined },
    { icon: Trophy,  label: "Auctions Won",    value: stats.auctions_won },
    { icon: BarChart3, label: "Total Bids",    value: stats.total_bids },
    { icon: Zap,     label: "Highest Bid",     value: `₹${(stats.highest_bid ?? 0).toLocaleString("en-IN")}` },
    { icon: Coins,   label: "Total Spent",     value: formatINR(stats.total_spent_cents) },
    { icon: Award,   label: "Badges",          value: stats.badges_count },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {s.label}
            </div>
            <div className="mt-1 text-xl font-black">{s.value}</div>
          </div>
        );
      })}
    </div>
  );
}
