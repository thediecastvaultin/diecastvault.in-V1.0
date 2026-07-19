import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Enforces per-product purchase limits (`max_per_customer`) at Add to Cart /
 * Checkout. Returns true when the requested quantity is allowed. Shows a toast
 * with a clear message when it isn't. Fails open (allows) if the RPC or the
 * user isn't available so guests can keep browsing.
 */
export async function ensurePurchaseAllowed(
  productId: string,
  requestedQty: number,
  fallbackName?: string,
): Promise<boolean> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return true; // guests: enforced again at checkout after sign-in
    const { data, error } = await supabase.rpc("check_purchase_limit", {
      _product_id: productId,
      _requested_qty: requestedQty,
    });
    if (error) return true;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.allowed !== false) return true;
    const name = row.product_name || fallbackName || "this item";
    const remaining = Math.max(0, (row.limit_per_customer ?? 0) - (row.already_purchased ?? 0));
    toast.error(`Purchase limit reached for ${name}`, {
      description:
        `Limit is ${row.limit_per_customer} per customer. ` +
        `You've already purchased ${row.already_purchased}. ` +
        (remaining > 0 ? `You can add ${remaining} more.` : "You can't add any more."),
      duration: 7000,
    });
    return false;
  } catch {
    return true;
  }
}
