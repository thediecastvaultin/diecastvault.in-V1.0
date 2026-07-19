import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettingsMap = Record<string, unknown>;

/** Simple scalar defaults (kept for backwards compatibility with existing settings UI). */
export const SETTINGS_DEFAULTS = {
  coming_soon_mode: false,
  default_low_stock_threshold: 3,
  hide_out_of_stock: false,
  admin_alert_email: "",
  low_stock_alert_threshold: 3,
  hero_line1: "Small cars.",
  hero_line2_prefix: "",
  hero_line2_italic: "Serious",
  hero_line2_suffix: "metal.",
  hero_subtitle:
    "A hand-curated vault of Hot Wheels — Mainlines, Premiums, Team Transports and the elusive Treasure Hunts. Mint carded. Shipped fast from the garage.",
  hero_cta_text: "Enter the vault",
  hero_cta_url: "/shop",
  announcement_enabled: false,
  announcement_text: "New drop every Friday — free shipping over ₹2,000.",
} as const;

export type SettingKey = keyof typeof SETTINGS_DEFAULTS;

/** Blob defaults (JSON objects stored under a single key). */
export type GeneralConfig = {
  site_name: string;
  logo_url: string;
  favicon_url: string;
  support_email: string;
  support_phone: string;
  business_address: string;
  footer_copyright: string;
  footer_description: string;
  maintenance_mode: boolean;
  maintenance_message: string;
};
export const GENERAL_DEFAULTS: GeneralConfig = {
  site_name: "The Diecast Vault",
  logo_url: "",
  favicon_url: "",
  support_email: "",
  support_phone: "",
  business_address: "",
  footer_copyright: `© ${new Date().getFullYear()} The Diecast Vault. Not affiliated with Mattel, Inc.`,
  footer_description:
    "Independent Hot Wheels die-cast shop. Mainlines, Premiums, Team Transports, Redlines & Treasure Hunts.",
  maintenance_mode: false,
  maintenance_message: "We're doing a quick tune-up on the vault. Back in a few minutes.",
};

export type HomepageHeroConfig = {
  bg_image_url: string;
  car_image_url: string;
  image_position: string; // e.g. "center", "top", "50% 30%"
  image_scale: number; // 1 = 100%
  overlay_opacity: number; // 0..1
  heading: string;
  subtitle: string;
  cta_text: string;
  cta_url: string;
};
export const HERO_DEFAULTS: HomepageHeroConfig = {
  bg_image_url: "",
  car_image_url: "",
  image_position: "center",
  image_scale: 1,
  overlay_opacity: 0.6,
  heading: "",
  subtitle: "",
  cta_text: "",
  cta_url: "/shop",
};

export type HomepageSectionsConfig = {
  show_featured: boolean;
  show_collections: boolean;
  show_new_drops: boolean;
  show_accessories: boolean;
};
export const SECTIONS_DEFAULTS: HomepageSectionsConfig = {
  show_featured: true,
  show_collections: true,
  show_new_drops: true,
  show_accessories: true,
};

export type ShopConfig = {
  currency: string;
  currency_symbol: string;
  shipping_cents: number;
  free_ship_threshold_cents: number;
  estimated_delivery_days: string;
  tax_percent: number;
  cod_enabled: boolean;
};
export const SHOP_DEFAULTS: ShopConfig = {
  currency: "INR",
  currency_symbol: "₹",
  shipping_cents: 9900,
  free_ship_threshold_cents: 200000,
  estimated_delivery_days: "3–5 business days",
  tax_percent: 18,
  cod_enabled: true,
};

export type InventoryConfig = {
  default_stock: number;
  low_stock_threshold: number;
  hide_out_of_stock: boolean;
  allow_backorders: boolean;
  auto_sold_out: boolean;
  auto_restore_stock: boolean;
};
export const INVENTORY_DEFAULTS: InventoryConfig = {
  default_stock: 10,
  low_stock_threshold: 3,
  hide_out_of_stock: false,
  allow_backorders: false,
  auto_sold_out: true,
  auto_restore_stock: false,
};

export type SocialLinks = {
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  discord: string;
  whatsapp: string;
  email: string;
};
export const SOCIAL_DEFAULTS: SocialLinks = {
  instagram: "",
  facebook: "",
  twitter: "",
  youtube: "",
  discord: "",
  whatsapp: "",
  email: "",
};

export type FooterLink = { label: string; href: string };
export type FooterConfig = {
  quick_links: FooterLink[];
  shop_links: FooterLink[];
  company_links: FooterLink[];
  legal_links: FooterLink[];
};
export const FOOTER_DEFAULTS: FooterConfig = {
  quick_links: [],
  shop_links: [
    { label: "Mainline", href: "/shop?series=Mainline" },
    { label: "Premium", href: "/shop?series=Premium" },
    { label: "Team Transport", href: "/shop?series=Team+Transport" },
    { label: "Treasure Hunts", href: "/shop?series=Treasure+Hunts" },
  ],
  company_links: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "My Collection", href: "/wishlist" },
  ],
  legal_links: [
    { label: "Terms of Service", href: "/legal/terms" },
    { label: "Privacy Policy", href: "/legal/privacy" },
    { label: "Returns & Refunds", href: "/legal/returns" },
    { label: "Shipping Policy", href: "/legal/shipping" },
  ],
};

export type NotificationPrefs = {
  auction_started: boolean;
  auction_ending_soon: boolean;
  auction_won: boolean;
  outbid: boolean;
  new_product_drop: boolean;
  order_confirmed: boolean;
  order_packed: boolean;
  order_shipped: boolean;
  order_delivered: boolean;
  staff_announcement: boolean;
  badge_awarded: boolean;
};
export const NOTIF_DEFAULTS: NotificationPrefs = {
  auction_started: true,
  auction_ending_soon: true,
  auction_won: true,
  outbid: true,
  new_product_drop: true,
  order_confirmed: true,
  order_packed: true,
  order_shipped: true,
  order_delivered: true,
  staff_announcement: true,
  badge_awarded: true,
};

async function fetchSettings(): Promise<SiteSettingsMap> {
  const { data } = await supabase.from("site_settings").select("key, value");
  const map: SiteSettingsMap = {};
  for (const row of data ?? []) map[row.key] = row.value;
  return map;
}

function coerce<K extends SettingKey>(raw: unknown, key: K): (typeof SETTINGS_DEFAULTS)[K] {
  const def = SETTINGS_DEFAULTS[key];
  if (raw == null) return def;
  if (typeof def === "boolean") return (raw === true) as (typeof SETTINGS_DEFAULTS)[K];
  if (typeof def === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    return (Number.isFinite(n) ? n : def) as (typeof SETTINGS_DEFAULTS)[K];
  }
  return (typeof raw === "string" ? raw : String(raw)) as (typeof SETTINGS_DEFAULTS)[K];
}

function mergeBlob<T extends Record<string, unknown>>(raw: unknown, defaults: T): T {
  if (!raw || typeof raw !== "object") return defaults;
  return { ...defaults, ...(raw as Partial<T>) } as T;
}

export function useSiteSettings() {
  const q = useQuery({ queryKey: ["site_settings"], queryFn: fetchSettings, staleTime: 30_000 });

  useEffect(() => {
    const suffix = Math.random().toString(36).slice(2, 10);
    const channel = supabase
      .channel(`site_settings_changes_${suffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, () => q.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function get<K extends SettingKey>(key: K): (typeof SETTINGS_DEFAULTS)[K] {
    return coerce(q.data?.[key], key);
  }

  const general = mergeBlob(q.data?.["general"], GENERAL_DEFAULTS);
  const homepageHero = mergeBlob(q.data?.["homepage_hero"], HERO_DEFAULTS);
  const homepageSections = mergeBlob(q.data?.["homepage_sections"], SECTIONS_DEFAULTS);
  const shop = mergeBlob(q.data?.["shop_config"], SHOP_DEFAULTS);
  const inventory = mergeBlob(q.data?.["inventory_config"], INVENTORY_DEFAULTS);
  const social = mergeBlob(q.data?.["social_links"], SOCIAL_DEFAULTS);
  const footer = mergeBlob(q.data?.["footer_config"], FOOTER_DEFAULTS);
  const notifPrefs = mergeBlob(q.data?.["notification_prefs"], NOTIF_DEFAULTS);

  return {
    comingSoon: get("coming_soon_mode"),
    hideOutOfStock: inventory.hide_out_of_stock || get("hide_out_of_stock"),
    defaultLowStockThreshold: get("default_low_stock_threshold"),
    hero: {
      line1: get("hero_line1"),
      line2Prefix: get("hero_line2_prefix"),
      line2Italic: get("hero_line2_italic"),
      line2Suffix: get("hero_line2_suffix"),
      subtitle: homepageHero.subtitle || get("hero_subtitle"),
      ctaText: homepageHero.cta_text || get("hero_cta_text"),
      ctaUrl: homepageHero.cta_url || get("hero_cta_url"),
      heading: homepageHero.heading,
      bgImageUrl: homepageHero.bg_image_url,
      carImageUrl: homepageHero.car_image_url,
      imagePosition: homepageHero.image_position,
      imageScale: homepageHero.image_scale,
      overlayOpacity: homepageHero.overlay_opacity,
    },
    announcement: {
      enabled: get("announcement_enabled"),
      text: get("announcement_text"),
    },
    general,
    homepageSections,
    shop,
    inventory,
    social,
    footer,
    notifPrefs,
    get,
    loading: q.isLoading,
  };
}
