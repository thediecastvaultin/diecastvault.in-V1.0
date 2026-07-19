import { rankStyles } from "@/lib/collector";
import { Crown } from "lucide-react";

export function RankBadge({ rank, size = "sm" }: { rank: string; size?: "sm" | "md" | "lg" }) {
  const s = rankStyles(rank);
  const sz = size === "lg" ? "text-xs px-3 py-1.5" : size === "md" ? "text-[11px] px-2.5 py-1" : "text-[10px] px-2 py-0.5";
  const ic = size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${s.bg} ${s.border} ${s.fg} ${s.glow} font-mono font-bold uppercase tracking-widest ${sz}`}>
      <Crown className={ic} />
      {rank}
    </span>
  );
}
