/**
 * Imports the product catalogue from the supplied Word document
 * (data/source/Code_Crest_Product_Catalogue_125_Products.docx)
 * and writes a normalised, validated JSON file to data/catalogue.json.
 *
 * Usage: npx tsx scripts/import-catalogue.ts [path-to-docx]
 *
 * The seed script (scripts/seed.ts) reads data/catalogue.json, so re-run this
 * script whenever the Word catalogue changes, then run `npm run db:seed`.
 */
import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { parse } from "node-html-parser";
import { CATEGORY_DEFS, applyPricingRule, nairaStringToKobo, slugify } from "../src/lib/catalogue-rules";

const DOCX = process.argv[2] ?? path.join(process.cwd(), "data/source/Code_Crest_Product_Catalogue_125_Products.docx");
const OUT = path.join(process.cwd(), "data/catalogue.json");

export type CatalogueRecord = {
  sku: string;
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  position: number;
  description: string;
  currency: "NGN";
  basePlanningPriceKobo: number;
  suggestedRetailPriceKobo: number;
  pricingAdjustmentKobo: number;
  pricingNote: string;
};

async function main() {
  const { value: html } = await mammoth.convertToHtml({ path: DOCX });
  const root = parse(html);
  const records: CatalogueRecord[] = [];
  let currentHeading = "";
  const usedSlugs = new Set<string>();

  for (const node of root.childNodes) {
    const el = node as unknown as { tagName?: string; text: string; querySelectorAll: (s: string) => { text: string; querySelectorAll: (s: string) => { text: string }[] }[] };
    if (!el.tagName) continue;
    const tag = el.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag)) {
      currentHeading = el.text.trim();
      continue;
    }
    if (tag !== "table") continue;
    const rows = el.querySelectorAll("tr").map((tr) => tr.querySelectorAll("td,th").map((c) => c.text.replace(/\s+/g, " ").trim()));
    if (!rows.length || !/^No\.?$/i.test(rows[0][0] ?? "")) continue;
    const cat = CATEGORY_DEFS.find((c) => c.docHeading.toLowerCase() === currentHeading.toLowerCase());
    if (!cat) throw new Error(`Unknown category heading in document: "${currentHeading}"`);

    for (const r of rows.slice(1)) {
      if (r.length < 5) continue;
      const [no, name, description, baseStr, suggestedStr] = r;
      const position = Number(no);
      const base = nairaStringToKobo(baseStr);
      const suggested = nairaStringToKobo(suggestedStr);
      const expected = applyPricingRule(base);
      if (expected !== suggested) {
        throw new Error(`Pricing rule mismatch for "${name}": base ${baseStr}, document suggests ${suggestedStr}, rule gives ₦${expected / 100}`);
      }
      let slug = slugify(name);
      if (usedSlugs.has(slug)) slug = `${slug}-${cat.code.toLowerCase()}`;
      usedSlugs.add(slug);
      const adjustment = suggested - base;
      records.push({
        sku: `CC-${cat.code}-${String(position).padStart(3, "0")}`,
        slug,
        name,
        categorySlug: cat.slug,
        categoryName: cat.name,
        position,
        description,
        currency: "NGN",
        basePlanningPriceKobo: base,
        suggestedRetailPriceKobo: suggested,
        pricingAdjustmentKobo: adjustment,
        pricingNote:
          adjustment > 0
            ? "Illustrative planning price from the Code Crest catalogue. ₦10,000 added because the base planning price is above ₦20,000. Not a verified supplier cost."
            : "Illustrative planning price from the Code Crest catalogue. Base planning price is ₦20,000 or less, so it is unchanged. Not a verified supplier cost.",
      });
    }
  }

  if (records.length !== 125) throw new Error(`Expected 125 products, found ${records.length}`);
  const skus = new Set(records.map((r) => r.sku));
  if (skus.size !== records.length) throw new Error("Duplicate SKUs detected");
  fs.writeFileSync(OUT, JSON.stringify(records, null, 2) + "\n");
  const adjusted = records.filter((r) => r.pricingAdjustmentKobo > 0).length;
  console.log(`Imported ${records.length} products (${adjusted} with the ₦10,000 adjustment) → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
