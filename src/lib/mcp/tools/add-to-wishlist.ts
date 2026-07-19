import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForCaller, textResult } from "../supabase";

export default defineTool({
  name: "add_to_wishlist",
  title: "Add to wishlist",
  description: "Add a product (by slug) to the signed-in user's wishlist.",
  inputSchema: {
    slug: z.string().trim().min(1).describe("Product slug to add."),
    owned: z.boolean().optional().describe("Mark as owned instead of wanted."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug, owned }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated.");
    const supabase = supabaseForCaller(ctx);
    const { data: product, error: pErr } = await supabase
      .from("products").select("id,name").eq("slug", slug).maybeSingle();
    if (pErr) return errorResult(pErr.message);
    if (!product) return errorResult(`No product found for slug "${slug}".`);
    const { data, error } = await supabase
      .from("wishlist")
      .upsert(
        { user_id: ctx.getUserId(), product_id: product.id, owned: owned ?? false },
        { onConflict: "user_id,product_id" },
      )
      .select().maybeSingle();
    if (error) return errorResult(error.message);
    return textResult({ added: true, product: product.name, item: data });
  },
});