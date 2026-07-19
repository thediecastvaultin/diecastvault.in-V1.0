import {
  Award, Zap, Gavel, Users, Trophy, Gem, Sparkles, Flame, Mountain, Car,
  Wrench, Star, BadgeCheck, ShieldCheck, type LucideIcon,
} from "lucide-react";

export const BADGE_ICONS: Record<string, LucideIcon> = {
  Award, Zap, Gavel, Users, Trophy, Gem, Sparkles, Flame, Mountain, Car,
  Wrench, Star, BadgeCheck, ShieldCheck,
};

export function badgeIcon(name?: string | null): LucideIcon {
  return (name && BADGE_ICONS[name]) || Award;
}

export type CollectorRank = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export const RANKS: CollectorRank[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

export function rankStyles(rank: string) {
  switch (rank) {
    case "Diamond":  return { fg: "text-cyan-300",   bg: "bg-cyan-500/15",   border: "border-cyan-400/40",   glow: "shadow-[0_0_20px_rgba(103,232,249,0.35)]" };
    case "Platinum": return { fg: "text-slate-100",  bg: "bg-slate-400/15",  border: "border-slate-300/40",  glow: "" };
    case "Gold":     return { fg: "text-amber-300",  bg: "bg-amber-500/15",  border: "border-amber-400/40",  glow: "" };
    case "Silver":   return { fg: "text-zinc-200",   bg: "bg-zinc-400/15",   border: "border-zinc-300/40",   glow: "" };
    default:         return { fg: "text-orange-300", bg: "bg-orange-500/15", border: "border-orange-400/40", glow: "" };
  }
}

export function formatINR(cents: number) {
  return "₹" + Math.round((cents ?? 0) / 100).toLocaleString("en-IN");
}
