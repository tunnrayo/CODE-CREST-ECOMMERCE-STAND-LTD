import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { policyPages, promotions } from "../db/schema";
import { notFound } from "../http";
import { audit, type Actor } from "./audit";

export const promotionSchema = z.object({
  title: z.string().trim().min(2).max(100),
  subtitle: z.string().trim().max(200).nullable().optional(),
  badge: z.string().trim().max(30).nullable().optional(),
  ctaLabel: z.string().trim().max(30).nullable().optional(),
  ctaHref: z
    .string()
    .trim()
    .max(200)
    .regex(/^\/[a-zA-Z0-9\-/_?=&.%]*$/, "Use an internal link that starts with /")
    .nullable()
    .optional(),
  placement: z.enum(["HOME_HERO", "HOME_STRIP"]).default("HOME_STRIP"),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  position: z.number().int().min(0).max(100).default(0),
});

export async function activePromotions(placement?: "HOME_HERO" | "HOME_STRIP") {
  const now = new Date();
  return db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.isActive, true),
        placement ? eq(promotions.placement, placement) : undefined,
        or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
        or(isNull(promotions.endsAt), gte(promotions.endsAt, now)),
      ),
    )
    .orderBy(asc(promotions.position));
}

export async function listPromotions() {
  return db.select().from(promotions).orderBy(asc(promotions.placement), asc(promotions.position));
}

export async function savePromotion(id: string | null, input: z.input<typeof promotionSchema>, actor: Actor) {
  const d = promotionSchema.parse(input);
  if (id) {
    const [p] = await db.update(promotions).set(d).where(eq(promotions.id, id)).returning();
    if (!p) throw notFound("Promotion not found");
    await audit(actor, "promotion.update", "promotion", id, { title: d.title, isActive: d.isActive });
    return p;
  }
  const [p] = await db.insert(promotions).values(d).returning();
  await audit(actor, "promotion.create", "promotion", p.id, { title: d.title });
  return p;
}

export async function deletePromotion(id: string, actor: Actor) {
  await db.delete(promotions).where(eq(promotions.id, id));
  await audit(actor, "promotion.delete", "promotion", id);
}

export const POLICY_SLUGS = ["shipping-policy", "returns-policy", "privacy-policy", "terms"] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

export async function getPolicy(slug: PolicySlug) {
  const [p] = await db.select().from(policyPages).where(eq(policyPages.slug, slug));
  return p ?? null;
}

export async function listPolicies() {
  return db.select().from(policyPages).orderBy(asc(policyPages.slug));
}

export const policySchema = z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(20).max(30000), isReviewed: z.boolean() });

export async function savePolicy(slug: PolicySlug, input: z.input<typeof policySchema>, actor: Actor) {
  const d = policySchema.parse(input);
  await db
    .insert(policyPages)
    .values({ slug, ...d })
    .onConflictDoUpdate({ target: policyPages.slug, set: { ...d, updatedAt: new Date() } });
  await audit(actor, "policy.update", "policy", slug, { isReviewed: d.isReviewed });
}
