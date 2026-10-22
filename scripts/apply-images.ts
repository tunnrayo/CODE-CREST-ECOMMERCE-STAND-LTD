/**
 * Links the locally stored product images (public/products/<SKU>.webp) to products in the database,
 * using data/image-manifest.json. Idempotent. Also removes the earlier generated illustrations so no
 * product shows an AI illustration: products without a matched image fall back to the neutral
 * "Image coming soon" placeholder.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/server/db";
import { productImages, products } from "../src/server/db/schema";

type Entry = { sku: string; file: string; board: string; boardIndex: number; boardLabel: string; match: "exact" | "similar" };

export async function applyImages() {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/image-manifest.json"), "utf8")) as Entry[];
  const all = await db.select({ id: products.id, sku: products.sku, name: products.name }).from(products);
  const bySku = new Map(all.map((p) => [p.sku, p]));
  const matched = new Set<string>();
  let linked = 0;
  for (const e of manifest) {
    const p = bySku.get(e.sku);
    if (!p) continue;
    if (!fs.existsSync(path.join(process.cwd(), "public", e.file))) { console.warn(`! file missing for ${e.sku}: ${e.file}`); continue; }
    matched.add(p.id);
    // drop generated illustrations for this product
    await db.delete(productImages).where(and(eq(productImages.productId, p.id), eq(productImages.sourceType, "ORIGINAL_ILLUSTRATION")));
    const existing = await db.select().from(productImages).where(and(eq(productImages.productId, p.id), eq(productImages.url, e.file)));
    const note =
      `Cropped from the owner-supplied Code Crest catalogue board "${e.board}" (item ${e.boardIndex}, labelled "${e.boardLabel}"). ` +
      (e.match === "exact" ? "Board label matches the product name." : "Board label is similar to, not identical with, the product name — confirm it shows the right item.") +
      " Not a supplier or manufacturer photograph; provenance of the original artwork is not documented.";
    const values = {
      productId: p.id,
      url: e.file,
      altText: p.name,
      width: 800,
      height: 800,
      sourceType: "ADMIN_UPLOAD" as const,
      sourceName: "Owner-supplied Code Crest catalogue board",
      sourcePageUrl: null,
      licenseStatus: "PERMITTED" as const,
      verificationStatus: "PENDING" as const,
      notes: note,
    };
    if (existing.length) {
      await db.update(productImages).set({ ...values, isPrimary: true }).where(eq(productImages.id, existing[0].id));
    } else {
      // keep any admin-uploaded primary image; otherwise make this the primary one
      const [primary] = await db.select().from(productImages).where(and(eq(productImages.productId, p.id), eq(productImages.isPrimary, true)));
      await db.insert(productImages).values({ ...values, isPrimary: !primary, position: 0 });
    }
    linked++;
  }
  // products with no matched board image: remove any generated illustration; they use the neutral fallback
  const unmatchedIds = all.filter((p) => !matched.has(p.id)).map((p) => p.id);
  let removed = 0;
  if (unmatchedIds.length) {
    const del = await db.delete(productImages).where(and(inArray(productImages.productId, unmatchedIds), eq(productImages.sourceType, "ORIGINAL_ILLUSTRATION"))).returning({ id: productImages.id });
    removed = del.length;
  }
  return { linked, withoutImage: unmatchedIds.length, illustrationsRemoved: removed };
}

if (process.argv[1] && /apply-images\.(ts|js)$/.test(process.argv[1])) {
  applyImages()
    .then((r) => { console.log(`✓ images linked: ${r.linked}; products using the placeholder: ${r.withoutImage}; old illustrations removed from unmatched products: ${r.illustrationsRemoved}`); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
