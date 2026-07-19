import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, supabaseForCaller, textResult } from "../supabase";

export default defineTool({
  name: "list_my_orders",
  title: "List my orders",
  description: "List the signed-in user's orders with status, totals, and line items.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated.");
    const supabase = supabaseForCaller(ctx);
    const { data, error } = await supabase
      .from("orders")
      .select("id,order_number,status,payment_method,total_cents,tracking_number,created_at,order_items(product_name,quantity,unit_price_cents)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return errorResult(error.message);
    return textResult({ count: data?.length ?? 0, orders: data ?? [] });
  },
});