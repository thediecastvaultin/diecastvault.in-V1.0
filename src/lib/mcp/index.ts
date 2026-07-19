import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import getProduct from "./tools/get-product";
import listWishlist from "./tools/list-wishlist";
import addToWishlist from "./tools/add-to-wishlist";
import removeFromWishlist from "./tools/remove-from-wishlist";
import listMyOrders from "./tools/list-my-orders";
import getActiveAuction from "./tools/get-active-auction";

// Direct Supabase host required for OAuth issuer — the .lovable.cloud proxy
// fails RFC 8414 issuer-match on mcp-js token verification.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "diecast-vault-mcp",
  title: "The Diecast Vault",
  version: "0.1.0",
  instructions:
    "Tools for The Diecast Vault — a Hot Wheels die-cast shop. Search the catalog, read product detail, view the caller's wishlist and orders, and inspect the live auction.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchProducts,
    getProduct,
    listWishlist,
    addToWishlist,
    removeFromWishlist,
    listMyOrders,
    getActiveAuction,
  ],
});