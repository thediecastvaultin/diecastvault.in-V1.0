import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForCaller, textResult } from "../supabase";

export default defineTool({
  name: "get_product",
  title: "Get product",
  description: "Fetch full detail for one product by its slug.",
  inputSchema: {
    slug: z.string().trim().min(1).describe("Product slug (URL segment)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }, ctx) => {
    const supabase = supabaseForCaller(ctx);
    const { data, error } = await supabase
      .from("products").select("*").eq("slug", slug).maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult(`No product found for slug "${slug}".`);
    return textResult(data);
  },
});