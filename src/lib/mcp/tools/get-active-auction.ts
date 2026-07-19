import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, supabaseForCaller, textResult } from "../supabase";

export default defineTool({
  name: "get_active_auction",
  title: "Get active auction",
  description: "Return the current active auction (product, status, starting bid, current highest bid, timer) if any.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const supabase = supabaseForCaller(ctx);
    const { data: setting, error } = await supabase
      .from("site_settings").select("value").eq("key", "active_auction").maybeSingle();
    if (error) return errorResult(error.message);
    if (!setting?.value) return textResult({ active: false });

    const auction = setting.value as { sessionId?: string } & Record<string, unknown>;
    let topBid: unknown = null;
    if (auction.sessionId) {
      const { data: bid } = await supabase
        .from("auction_events")
        .select("display_name,amount,created_at")
        .eq("session_id", auction.sessionId)
        .eq("kind", "bid")
        .order("amount", { ascending: false })
        .limit(1)
        .maybeSingle();
      topBid = bid ?? null;
    }
    return textResult({ active: true, auction, topBid });
  },
});