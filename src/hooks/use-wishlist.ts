import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { toast } from "sonner";

export type WishlistEntry = {
  id: string;
  product_id: string;
  owned: boolean;
};

export function useWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    enabled: !!userId,
    queryKey: ["wishlist", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist")
        .select("id, product_id, owned")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WishlistEntry[];
    },
  });

  const add = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) throw new Error("Sign in to save cars.");
      const { error } = await supabase
        .from("wishlist")
        .insert({ user_id: userId, product_id: productId });
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlist", userId] });
      qc.invalidateQueries({ queryKey: ["wishlist-detailed", userId] });
      toast.success("Saved to your collection");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from("wishlist")
        .delete()
        .eq("user_id", userId)
        .eq("product_id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlist", userId] });
      qc.invalidateQueries({ queryKey: ["wishlist-detailed", userId] });
    },
  });

  const toggleOwned = useMutation({
    mutationFn: async ({ productId, owned }: { productId: string; owned: boolean }) => {
      if (!userId) throw new Error("Sign in first.");
      const { error } = await supabase
        .from("wishlist")
        .update({ owned })
        .eq("user_id", userId)
        .eq("product_id", productId);
      if (error) throw error;
    },
    onMutate: async ({ productId, owned }) => {
      await qc.cancelQueries({ queryKey: ["wishlist", userId] });
      await qc.cancelQueries({ queryKey: ["wishlist-detailed", userId] });
      const prev = qc.getQueryData<WishlistEntry[]>(["wishlist", userId]);
      const prevDetailed = qc.getQueryData<any[]>(["wishlist-detailed", userId]);
      if (prev) {
        qc.setQueryData<WishlistEntry[]>(["wishlist", userId], prev.map((e) =>
          e.product_id === productId ? { ...e, owned } : e,
        ));
      }
      if (prevDetailed) {
        qc.setQueryData<any[]>(["wishlist-detailed", userId], prevDetailed.map((i) =>
          i.id === productId ? { ...i, owned } : i,
        ));
      }
      return { prev, prevDetailed };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["wishlist", userId], ctx.prev);
      if (ctx?.prevDetailed) qc.setQueryData(["wishlist-detailed", userId], ctx.prevDetailed);
      toast.error("Could not update. Try again.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["wishlist", userId] });
      qc.invalidateQueries({ queryKey: ["wishlist-detailed", userId] });
    },
  });

  const entries = query.data ?? [];
  const productIds = new Set(entries.map((e) => e.product_id));
  const ownedIds = new Set(entries.filter((e) => e.owned).map((e) => e.product_id));

  return {
    entries,
    productIds,
    ownedIds,
    count: entries.length,
    isSaved: (id: string) => productIds.has(id),
    isOwned: (id: string) => ownedIds.has(id),
    add: add.mutate,
    remove: remove.mutate,
    toggleOwned: toggleOwned.mutate,
    isReady: !!userId && !query.isLoading,
    signedIn: !!userId,
  };
}
