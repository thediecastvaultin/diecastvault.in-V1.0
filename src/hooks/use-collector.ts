import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserStats = {
  auctions_joined: number;
  auctions_won: number;
  total_bids: number;
  highest_bid: number;
  total_spent_cents: number;
  avg_win_price: number;
  win_rate: number;
  favorite_category: string;
  member_since: string | null;
  badges_count: number;
};

export function useUserStats(userId?: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["user-stats", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_stats", { _user: userId! });
      if (error) throw error;
      return data as unknown as UserStats;
    },
  });
}

export function useUserRank(userId?: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["user-rank", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_rank", { _user: userId! });
      if (error) throw error;
      return (data as unknown as string) || "Bronze";
    },
  });
}

export type EarnedBadge = { code: string; name: string; description: string; icon: string; category: string; earned_at: string };

export function useUserBadges(userId?: string | null) {
  return useQuery<EarnedBadge[]>({
    enabled: !!userId,
    queryKey: ["user-badges", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_badges")
        .select("earned_at, badge_code, badges!inner(code,name,description,icon,category)")
        .eq("user_id", userId!)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        code: r.badges.code, name: r.badges.name, description: r.badges.description,
        icon: r.badges.icon, category: r.badges.category, earned_at: r.earned_at,
      }));
    },
  });
}

export function useUserActivity(userId?: string | null, limit = 30) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["user-activity", userId, limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("activity_events")
        .select("id, kind, title, description, link, meta, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as Array<{ id: string; kind: string; title: string; description: string | null; link: string | null; meta: any; created_at: string }>;
    },
  });
}
