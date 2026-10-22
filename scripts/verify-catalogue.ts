/** Verifies the database catalogue against data/catalogue.json (imported from the supplied document). */
import "dotenv/config";
import fs from "node:fs";
import { db } from "../src/server/db";
import { products, productImages } from "../src/server/db/schema";
import { applyPricingRule } from "../src/lib/catalogue-rules";

async function main() {
type Row = { sku: string; name: string; basePlanningPriceKobo: number; suggestedRetailPriceKobo: number };
const src = JSON.parse(fs.readFileSync("data/catalogue.json", "utf8")) as Row[];
const rows = await db.select().from(products);
const imgs = await db.select().from(productImages);
const bySku = new Map(rows.map((r) => [r.sku, r]));
const problems: string[] = [];
if (src.length !== 125) problems.push(`source has ${src.length} products, expected 125`);
if (rows.length < 125) problems.push(`database has ${rows.length} products, expected at least 125`);
let adjusted = 0;
for (const s of src) {
  const p = bySku.get(s.sku);
  if (!p) { problems.push(`${s.sku} missing in database`); continue; }
  if (p.name !== s.name) problems.push(`${s.sku} name differs`);
  if (p.basePlanningPriceKobo !== s.basePlanningPriceKobo) problems.push(`${s.sku} base price differs`);
  if (applyPricingRule(s.basePlanningPriceKobo) !== s.suggestedRetailPriceKobo) problems.push(`${s.sku} rule mismatch in source`);
  if (s.suggestedRetailPriceKobo !== s.basePlanningPriceKobo) adjusted++;
}
console.log(`source products: ${src.length}; db products: ${rows.length}; price-adjusted (+₦10,000): ${adjusted}`);
console.log(`products with an image record: ${new Set(imgs.map((i) => i.productId)).size}`);
if (problems.length) { console.error("PROBLEMS:\n" + problems.join("\n")); process.exit(1); }
console.log("✓ catalogue verified: names, base prices, pricing rule");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
