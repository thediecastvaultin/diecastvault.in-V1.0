import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForCaller, textResult } from "../supabase";

export default defineTool({
  name: "remove_from_wishlist",
  title: "Remove from wishlist",
  description: "Remove a product (by slug) from the signed-in user's wishlist.",
  inputSchema: {
    slug: z.string().trim().min(1).describe("Product slug to remove."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated.");
    const supabase = supabaseForCaller(ctx);
    const { data: product, error: pErr } = await supabase
      .from("products").select("id").eq("slug", slug).maybeSingle();
    if (pErr) return errorResult(pErr.message);
    if (!product) return errorResult(`No product found for slug "${slug}".`);
    const { error } = await supabase
      .from("wishlist").delete()
      .eq("user_id", ctx.getUserId()).eq("product_id", product.id);
    if (error) return errorResult(error.message);
    return textResult({ removed: true, slug });
  },
});