// Indian mobile number utilities.
// Valid format: 10 digits starting with 6-9. Accepts optional +91 / 0 prefix on input.

export function normalizeIndianPhone(input: string): string {
  const digits = (input || "").replace(/\D+/g, "");
  // Strip country code (91) or trunk prefix (0)
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidIndianPhone(input: string): boolean {
  const n = normalizeIndianPhone(input);
  return /^[6-9]\d{9}$/.test(n);
}

/** Pretty format: +91 9876543210. Falls back to raw input if not valid. */
export function formatIndianPhone(input?: string | null): string {
  if (!input) return "";
  const n = normalizeIndianPhone(input);
  if (!/^[6-9]\d{9}$/.test(n)) return input;
  return `+91 ${n}`;
}


/** Display a phone or the "Not Provided" fallback used across the site. */
export function displayPhone(input?: string | null): string {
  const s = (input ?? "").trim();
  if (!s) return "Not Provided";
  return formatIndianPhone(s);
}
