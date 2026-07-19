import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForCaller, textResult } from "../supabase";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search the Diecast Vault catalog by keyword (name, series, description). Returns matching products with slug, name, series, year, price, rarity, and stock.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Search text — matches name/series/description."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    const supabase = supabaseForCaller(ctx);
    const like = `%${query}%`;
    const { data, error } = await supabase
      .from("products")
      .select("slug,name,series,year,price_cents,rarity,color,stock_quantity,featured")
      .or(`name.ilike.${like},series.ilike.${like},description.ilike.${like}`)
      .limit(limit ?? 20);
    if (error) return errorResult(error.message);
    return textResult({ count: data?.length ?? 0, products: data ?? [] });
  },
});