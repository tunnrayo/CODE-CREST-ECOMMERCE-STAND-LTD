import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, asc, eq, ne } from "drizzle-orm";
import sharp, { type OutputInfo } from "sharp";
import { z } from "zod";
import { db } from "../db";
import { productImages, products } from "../db/schema";
import { badRequest, notFound } from "../http";
import { audit, type Actor } from "./audit";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used for the derived type
const ALLOWED = ["image/jpeg", "image/png", "image/webp"] as const;

export function uploadDir() {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "storage", "uploads");
}

/** Detect real file type from magic bytes — never trust the client's MIME type. */
export function sniffImageType(buf: Buffer): (typeof ALLOWED)[number] | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export const imageMetaSchema = z.object({
  altText: z.string().trim().min(3, "Alt text is required").max(200),
  sourceType: z.enum(["ORIGINAL_ILLUSTRATION", "MANUFACTURER", "SUPPLIER", "STOCK_LICENSED", "ADMIN_UPLOAD", "PLACEHOLDER"]),
  sourceName: z.string().trim().max(120).nullable().optional(),
  sourcePageUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("").transform(() => null)),
  licenseStatus: z.enum(["OWNED", "PERMITTED", "LICENSED", "PENDING_PERMISSION", "UNKNOWN"]),
  verificationStatus: z.enum(["VERIFIED", "PENDING", "NEEDS_REPLACEMENT"]),
  notes: z.string().trim().max(500).nullable().optional(),
});

/** An image may only be marked VERIFIED when its licence status supports commercial use. */
function assertVerifiable(meta: z.infer<typeof imageMetaSchema>) {
  if (meta.verificationStatus === "VERIFIED" && !["OWNED", "PERMITTED", "LICENSED"].includes(meta.licenseStatus)) {
    throw badRequest("An image can only be marked verified when its licence status is Owned, Permitted or Licensed.");
  }
  if (meta.verificationStatus === "VERIFIED" && ["SUPPLIER", "MANUFACTURER", "STOCK_LICENSED"].includes(meta.sourceType) && !meta.sourcePageUrl && !meta.sourceName) {
    throw badRequest("Record the source name or page URL before verifying a third-party image.");
  }
}

export async function processAndStoreUpload(productId: string, file: File, meta: z.input<typeof imageMetaSchema>, actor: Actor, makePrimary = false) {
  const m = imageMetaSchema.parse(meta);
  assertVerifiable(m);
  const [p] = await db.select({ id: products.id, slug: products.slug }).from(products).where(eq(products.id, productId));
  if (!p) throw notFound("Product not found");
  if (!file || typeof file.arrayBuffer !== "function") throw badRequest("No file uploaded.");
  if (file.size > MAX_UPLOAD_BYTES) throw badRequest("Image must be 5 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) throw badRequest("Image must be 5 MB or smaller.");
  const type = sniffImageType(buf);
  if (!type) throw badRequest("Only JPEG, PNG or WebP images are allowed.");

  let out: { data: Buffer; info: OutputInfo };
  try {
    const img = sharp(buf, { limitInputPixels: 40_000_000 }).rotate();
    const metaInfo = await img.metadata();
    if (!metaInfo.width || !metaInfo.height || metaInfo.width < 200 || metaInfo.height < 200) throw badRequest("Image must be at least 200×200 pixels.");
    // Re-encode (strips metadata/EXIF and any embedded payloads), square-pad for consistent cards.
    out = await img
      .resize(1200, 1200, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 }, withoutEnlargement: false })
      .flatten({ background: "#ffffff" })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
  } catch (e) {
    if (e instanceof Error && "status" in e) throw e;
    throw badRequest("The file could not be read as an image.");
  }

  const key = `products/${p.slug}-${crypto.randomBytes(6).toString("hex")}.webp`;
  const abs = path.join(uploadDir(), key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, out.data);

  const existing = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId));
  const primary = makePrimary || existing.length === 0;
  const [row] = await db.transaction(async (tx) => {
    if (primary) await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
    return tx
      .insert(productImages)
      .values({
        productId,
        url: `/media/${key}`,
        storageKey: key,
        altText: m.altText,
        isPrimary: primary,
        position: existing.length,
        width: out.info.width,
        height: out.info.height,
        sourceType: m.sourceType,
        sourceName: m.sourceName ?? null,
        sourcePageUrl: m.sourcePageUrl ?? null,
        licenseStatus: m.licenseStatus,
        verificationStatus: m.verificationStatus,
        notes: m.notes ?? null,
      })
      .returning();
  });
  await audit(actor, "image.upload", "product", productId, { imageId: row.id, sourceType: m.sourceType, licenseStatus: m.licenseStatus });
  return row;
}

export async function updateImageMeta(imageId: string, meta: z.input<typeof imageMetaSchema>, actor: Actor) {
  const m = imageMetaSchema.parse(meta);
  assertVerifiable(m);
  const [row] = await db.update(productImages).set(m).where(eq(productImages.id, imageId)).returning();
  if (!row) throw notFound("Image not found");
  await audit(actor, "image.update", "product", row.productId, { imageId, verificationStatus: m.verificationStatus, licenseStatus: m.licenseStatus });
  return row;
}

export async function setPrimaryImage(imageId: string, actor: Actor) {
  const [img] = await db.select().from(productImages).where(eq(productImages.id, imageId));
  if (!img) throw notFound("Image not found");
  await db.transaction(async (tx) => {
    await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, img.productId));
    await tx.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, imageId));
  });
  await audit(actor, "image.primary", "product", img.productId, { imageId });
}

export async function deleteImage(imageId: string, actor: Actor) {
  const [img] = await db.delete(productImages).where(eq(productImages.id, imageId)).returning();
  if (!img) throw notFound("Image not found");
  if (img.storageKey && !img.storageKey.includes("..")) {
    await fs.rm(path.join(uploadDir(), img.storageKey), { force: true }).catch(() => undefined);
  }
  if (img.isPrimary) {
    const [next] = await db.select().from(productImages).where(and(eq(productImages.productId, img.productId), ne(productImages.id, img.id))).orderBy(asc(productImages.position)).limit(1);
    if (next) await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, next.id));
  }
  await audit(actor, "image.delete", "product", img.productId, { imageId, url: img.url });
}
