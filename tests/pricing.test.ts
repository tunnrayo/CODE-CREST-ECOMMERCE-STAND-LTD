import { describe, expect, it } from "vitest";
import { applyPricingRule, nairaStringToKobo, slugify } from "@/lib/catalogue-rules";
import { formatKobo } from "@/lib/format";
import catalogue from "../data/catalogue.json";

describe("pricing rule", () => {
  it("adds ₦10,000 only when base is strictly above ₦20,000", () => {
    expect(applyPricingRule(nairaStringToKobo("20000"))).toBe(2_000_000);
    expect(applyPricingRule(nairaStringToKobo("20001"))).toBe(3_000_100);
    expect(applyPricingRule(nairaStringToKobo("19999"))).toBe(1_999_900);
    expect(applyPricingRule(nairaStringToKobo("45000"))).toBe(5_500_000);
  });
  it("parses naira strings into integer kobo", () => {
    expect(nairaStringToKobo("₦1,250.50")).toBe(125_050);
    expect(nairaStringToKobo("8,500")).toBe(850_000);
  });
});

describe("format", () => {
  it("formats kobo as naira", () => {
    expect(formatKobo(1_550_000)).toContain("15,500");
    expect(formatKobo(null)).toBeTypeOf("string");
  });
  it("slugifies", () => {
    expect(slugify("Wireless Earbuds & Case!")).toBe("wireless-earbuds-and-case");
  });
});

describe("catalogue.json (imported from the supplied document)", () => {
  const rows = catalogue as { sku: string; slug: string; basePlanningPriceKobo: number; suggestedRetailPriceKobo: number }[];
  it("has exactly 125 unique products", () => {
    expect(rows).toHaveLength(125);
    expect(new Set(rows.map((r) => r.sku)).size).toBe(125);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(125);
  });
  it("suggested price equals the rule applied exactly once to the base price", () => {
    for (const r of rows) expect(r.suggestedRetailPriceKobo, r.sku).toBe(applyPricingRule(r.basePlanningPriceKobo));
  });
});

describe("kobo display", () => {
  it("shows whole naira without decimals and fractions with two", () => {
    expect(formatKobo(1_800_000)).toBe("₦18,000");
    expect(formatKobo(123_450)).toBe("₦1,234.50");
  });
});
