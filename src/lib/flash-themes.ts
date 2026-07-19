export type FlashTheme = "default" | "promo" | "limited" | "important" | "maintenance";

export const FLASH_THEMES: Record<FlashTheme, { label: string; color: string; purpose: string }> = {
  default: { label: "Default", color: "#F3F3F3", purpose: "General announcements, new arrivals, restocks, auction news, website updates." },
  promo: { label: "Promo", color: "#E91E63", purpose: "Sales, discounts, coupon codes, flash deals, free shipping." },
  limited: { label: "Limited", color: "#FF9800", purpose: "Low stock, selling fast, last chance, limited quantity." },
  important: { label: "Important", color: "#F44336", purpose: "Urgent announcements, auction ending soon, critical updates." },
  maintenance: { label: "Maintenance", color: "#00BCD4", purpose: "Scheduled maintenance, downtime, technical updates." },
};

export function themeColor(kind: string | null | undefined): string {
  const k = (kind ?? "default") as FlashTheme;
  return FLASH_THEMES[k]?.color ?? FLASH_THEMES.default.color;
}

export function themeLabel(kind: string | null | undefined): string {
  const k = (kind ?? "default") as FlashTheme;
  return FLASH_THEMES[k]?.label ?? "Default";
}
