import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { categories, products } from "@/server/db/schema";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticPaths = ["", "/shop", "/categories", "/about", "/contact", "/faq", "/track-order", "/shipping-policy", "/returns-policy", "/privacy-policy", "/terms"];
  try {
    const [prods, cats] = await Promise.all([
      db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(eq(products.status, "PUBLISHED")),
      db.select({ slug: categories.slug, updatedAt: categories.updatedAt }).from(categories).where(eq(categories.isActive, true)),
    ]);
    return [
      ...staticPaths.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
      ...cats.map((c) => ({ url: `${base}/category/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...prods.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ];
  } catch {
    return staticPaths.map((p) => ({ url: `${base}${p}` }));
  }
}
