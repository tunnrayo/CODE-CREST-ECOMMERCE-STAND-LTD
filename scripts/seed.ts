/**
 * Idempotent seed: categories, all 125 catalogue products, illustration
 * images with source metadata, default settings, shipping zone, promotions
 * and draft policies. Safe to run repeatedly — existing records are matched
 * by stable keys (category slug, product catalogue key/SKU) and NOT duplicated.
 *
 * By default, admin edits to existing products are preserved.
 * Run with `--sync-catalogue` to re-apply names/descriptions/planning prices
 * from data/catalogue.json (retail prices are only reset with `--reset-prices`).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { getDb, getPool } from "../src/server/db";
import { categories, policyPages, productImages, products, promotions, shippingMethods, shippingZones, storeSettings } from "../src/server/db/schema";
import { CATEGORY_DEFS } from "../src/lib/catalogue-rules";
import { DEFAULT_SETTINGS } from "../src/server/services/settings";
import { POLICY_SEED } from "../data/policies";
import type { CatalogueRecord } from "./import-catalogue";

const FEATURED = new Set(["CC-ELE-002", "CC-ELE-005", "CC-HOM-005", "CC-FAS-002", "CC-BEA-006", "CC-OFF-009", "CC-BAB-003", "CC-SPO-001"]);

async function main() {
  const db = getDb();
  const sync = process.argv.includes("--sync-catalogue");
  const resetPrices = process.argv.includes("--reset-prices");
  const catalogue: CatalogueRecord[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/catalogue.json"), "utf8"));

  // Categories
  const catIds = new Map<string, string>();
  for (const [i, c] of CATEGORY_DEFS.entries()) {
    const [row] = await db
      .insert(categories)
      .values({ slug: c.slug, name: c.name, code: c.code, description: c.blurb, icon: c.icon, position: i })
      .onConflictDoUpdate({ target: categories.slug, set: { code: c.code } })
      .returning({ id: categories.id });
    catIds.set(c.slug, row.id);
  }

  let created = 0;
  let existing = 0;
  let imagesAdded = 0;
  for (const r of catalogue) {
    const categoryId = catIds.get(r.categorySlug)!;
    const keywords = [r.categoryName, ...r.name.toLowerCase().split(/[^a-z0-9]+/)].filter(Boolean).join(" ");
    const [found] = await db.select().from(products).where(eq(products.catalogueKey, r.sku)).limit(1);
    let productId: string;
    if (!found) {
      const [p] = await db
        .insert(products)
        .values({
          sku: r.sku,
          slug: r.slug,
          name: r.name,
          categoryId,
          description: r.description,
          keywords,
          status: "PUBLISHED",
          isFeatured: FEATURED.has(r.sku),
          currency: "NGN",
          basePlanningPriceKobo: r.basePlanningPriceKobo,
          catalogueSuggestedPriceKobo: r.suggestedRetailPriceKobo,
          retailPriceKobo: r.suggestedRetailPriceKobo, // document's final suggested price — no further adjustment
          verificationStatus: "UNVERIFIED",
          pricingNote: r.pricingNote,
          catalogueSource: "Code_Crest_Product_Catalogue_125_Products.docx",
          catalogueKey: r.sku,
          stockStatus: "UNKNOWN",
          publishedAt: new Date(),
        })
        .returning({ id: products.id });
      productId = p.id;
      created++;
    } else {
      productId = found.id;
      existing++;
      if (sync) {
        await db
          .update(products)
          .set({
            name: r.name,
            description: r.description,
            categoryId,
            basePlanningPriceKobo: r.basePlanningPriceKobo,
            catalogueSuggestedPriceKobo: r.suggestedRetailPriceKobo,
            pricingNote: r.pricingNote,
            ...(resetPrices ? { retailPriceKobo: r.suggestedRetailPriceKobo, salePriceKobo: null } : {}),
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId));
      }
    }

    const [hasImage] = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId)).limit(1);
    const illustration = `/products/${r.slug}.webp`;
    if (!hasImage && fs.existsSync(path.join(process.cwd(), "public", illustration))) {
      await db.insert(productImages).values({
        productId,
        url: illustration,
        altText: `${r.name} — Code Crest product illustration`,
        isPrimary: true,
        position: 0,
        width: 800,
        height: 800,
        sourceType: "ORIGINAL_ILLUSTRATION",
        sourceName: "Code Crest (generated with Phosphor Icons, MIT licence)",
        sourcePageUrl: "https://phosphoricons.com",
        licenseStatus: "OWNED",
        verificationStatus: "PENDING",
        notes: "Illustrative image, not a photograph of the actual product. Replace with a verified supplier/manufacturer photo before launch.",
      });
      imagesAdded++;
    }
  }

  // Settings (only insert missing keys — never overwrite admin changes)
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (value === null) continue; // defaults are merged at read time
    await db.insert(storeSettings).values({ key, value: value as object }).onConflictDoNothing();
  }

  // Shipping: one zone, fee NOT confirmed (no invented prices)
  const [zone] = await db.select().from(shippingZones).where(eq(shippingZones.name, "Nigeria — all states")).limit(1);
  const zoneId = zone?.id ?? (await db.insert(shippingZones).values({ name: "Nigeria — all states", countries: ["NG"], states: [] }).returning({ id: shippingZones.id }))[0].id;
  const [method] = await db.select().from(shippingMethods).where(and(eq(shippingMethods.zoneId, zoneId), eq(shippingMethods.name, "Standard delivery"))).limit(1);
  if (!method) {
    await db.insert(shippingMethods).values({
      zoneId,
      name: "Standard delivery",
      description: "Delivery fee is confirmed by Code Crest after we review your order and address.",
      feeKobo: null,
      feeConfirmed: false,
      position: 0,
    });
  }

  // Promotions (informational only — no invented discounts)
  const [{ n: promoCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(promotions);
  if (Number(promoCount) === 0) {
    await db.insert(promotions).values([
      { title: "125 products. 7 categories.", subtitle: "Explore the new Code Crest catalogue — from gadgets to kitchen, fashion, beauty and more.", badge: "New catalogue", ctaLabel: "Shop all", ctaHref: "/shop", placement: "HOME_STRIP", position: 0 },
      { title: "Work & study setup", subtitle: "Laptop stands, keyboards, webcams, organisers and more for home and office.", badge: "Collection", ctaLabel: "Browse office", ctaHref: "/category/office-study", placement: "HOME_STRIP", position: 1 },
      { title: "Everyday gadgets", subtitle: "Charging, audio and smart accessories for daily life.", badge: "Collection", ctaLabel: "Browse electronics", ctaHref: "/category/electronics-gadgets", placement: "HOME_STRIP", position: 2 },
    ]);
  }

  for (const p of POLICY_SEED) {
    await db.insert(policyPages).values({ ...p, isReviewed: false }).onConflictDoNothing();
  }

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(products).where(sql`${products.catalogueKey} is not null`);
  console.log(`✓ Seed complete — catalogue products in DB: ${total} (created ${created}, already present ${existing}${sync ? ", synced" : ""}); images added: ${imagesAdded}`);
  await getPool().end();
}

main().catch(async (e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
