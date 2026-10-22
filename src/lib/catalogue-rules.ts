/** Pure catalogue rules shared by the importer, seed, tests and app. */

export const CATEGORY_DEFS = [
  { code: "ELE", slug: "electronics-gadgets", name: "Electronics & Gadgets", docHeading: "Electronics & Gadgets", icon: "headphones", blurb: "Audio, charging, computer accessories and smart gadgets." },
  { code: "HOM", slug: "home-kitchen", name: "Home & Kitchen", docHeading: "Home & Kitchen", icon: "cooking-pot", blurb: "Cookware, storage, cleaning and home comfort." },
  { code: "FAS", slug: "fashion-accessories", name: "Fashion & Accessories", docHeading: "Fashion & Accessories", icon: "handbag", blurb: "Bags, everyday wear, travel and accessories." },
  { code: "BEA", slug: "beauty-personal-care", name: "Beauty & Personal Care", docHeading: "Beauty & Personal Care", icon: "sparkle", blurb: "Grooming tools, hair care and self-care essentials." },
  { code: "OFF", slug: "office-study", name: "Office & Study", docHeading: "Office & Study", icon: "notebook", blurb: "Organisers, stationery and workspace comfort." },
  { code: "BAB", slug: "baby-kids", name: "Baby & Kids", docHeading: "Baby & Kids", icon: "baby", blurb: "Learning, play, school and baby-care items." },
  { code: "SPO", slug: "sports-outdoor", name: "Sports & Outdoor", docHeading: "Sports & Outdoor", icon: "barbell", blurb: "Fitness, training and outdoor leisure gear." },
] as const;

export type CategorySlug = (typeof CATEGORY_DEFS)[number]["slug"];

/** ₦20,000 threshold and ₦10,000 adjustment, in kobo. */
export const PRICING_THRESHOLD_KOBO = 20_000_00;
export const PRICING_ADJUSTMENT_KOBO = 10_000_00;

/**
 * Catalogue pricing rule: if the base planning price is strictly greater
 * than ₦20,000 add ₦10,000; otherwise leave it unchanged.
 * Apply ONLY to a base planning price — never to an already-adjusted price.
 */
export function applyPricingRule(basePlanningPriceKobo: number): number {
  if (!Number.isInteger(basePlanningPriceKobo) || basePlanningPriceKobo < 0) throw new Error("Price must be a non-negative integer in kobo");
  return basePlanningPriceKobo > PRICING_THRESHOLD_KOBO ? basePlanningPriceKobo + PRICING_ADJUSTMENT_KOBO : basePlanningPriceKobo;
}

/** "₦18,000" → 1800000 (kobo) */
export function nairaStringToKobo(s: string): number {
  const cleaned = s.replace(/[₦,\s]/g, "").replace(/^NGN/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error(`Invalid naira amount: "${s}"`);
  return Math.round(Number(cleaned) * 100);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
