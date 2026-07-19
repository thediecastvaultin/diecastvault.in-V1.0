import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, supabaseForCaller, textResult } from "../supabase";

export default defineTool({
  name: "list_wishlist",
  title: "List my wishlist",
  description: "List the signed-in user's wishlist items (wanted and owned).",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated.");
    const supabase = supabaseForCaller(ctx);
    const { data, error } = await supabase
      .from("wishlist")
      .select("id,owned,created_at,products(slug,name,series,year,price_cents,rarity)")
      .order("created_at", { ascending: false });
    if (error) return errorResult(error.message);
    return textResult({ count: data?.length ?? 0, items: data ?? [] });
  },
});