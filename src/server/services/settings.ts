import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { BRAND } from "@/lib/brand";
import { db } from "../db";
import { storeSettings } from "../db/schema";

export const settingsSchema = z.object({
  storeName: z.string().min(1).max(80),
  legalName: z.string().min(1).max(120),
  rcNumber: z.string().max(40),
  tagline: z.string().max(120),
  supportEmail: z.string().email(),
  addressLines: z.array(z.string().max(120)).max(5),
  logoUrl: z.string().max(300).nullable(),
  currency: z.literal("NGN"),
  locale: z.string().max(10),
  country: z.string().length(2),
  announcement: z.string().max(200),
  heroTitle: z.string().max(80),
  heroSubtitle: z.string().max(240),
  /**
   * REQUEST: customers submit order requests; no online payment is taken and
   * Code Crest confirms price, availability and delivery before payment.
   * LIVE: online payment required; only supplier-verified products with
   * confirmed delivery fees can be ordered.
   */
  orderMode: z.enum(["REQUEST", "LIVE"]),
  showUnverifiedNotice: z.boolean(),
  colors: z.object({ burgundy: z.string(), lime: z.string() }),
});
export type StoreSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: BRAND.name,
  legalName: BRAND.legalName,
  rcNumber: BRAND.rcNumber,
  tagline: BRAND.tagline,
  supportEmail: BRAND.email,
  addressLines: [...BRAND.address],
  logoUrl: null,
  currency: "NGN",
  locale: "en-NG",
  country: "NG",
  announcement: "Welcome to Code Crest — our catalogue is in pre-launch. Prices and availability are confirmed with you before payment.",
  heroTitle: "Smart Shopping. Seamless Living.",
  heroSubtitle: "Everyday electronics, home, fashion, beauty, office, kids and outdoor essentials — curated by Code Crest from Abuja.",
  orderMode: "REQUEST",
  showUnverifiedNotice: true,
  colors: { burgundy: BRAND.colors.burgundy, lime: BRAND.colors.lime },
};

export async function getSettings(): Promise<StoreSettings> {
  try {
    const rows = await db.select().from(storeSettings);
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
    const parsed = settingsSchema.safeParse(merged);
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch (e) {
    console.error("[settings] falling back to defaults:", (e as Error).message);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(patch: Partial<StoreSettings>, actorId?: string) {
  const current = await getSettings();
  const next = settingsSchema.parse({ ...current, ...patch });
  const keys = Object.keys(patch) as (keyof StoreSettings)[];
  for (const k of keys) {
    const value = sql`${JSON.stringify(next[k])}::jsonb`;
    await db
      .insert(storeSettings)
      .values({ key: k, value, updatedBy: actorId ?? null })
      .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date(), updatedBy: actorId ?? null } });
  }
  return next;
}

export async function deleteSettings(keys: string[]) {
  if (keys.length) await db.delete(storeSettings).where(inArray(storeSettings.key, keys));
}

export async function getSettingRaw(key: string) {
  const [r] = await db.select().from(storeSettings).where(eq(storeSettings.key, key));
  return r?.value;
}

/** Integration status derived from server-side environment (never exposes secrets). */
export function integrationStatus() {
  const paystackKey = process.env.PAYSTACK_SECRET_KEY ?? "";
  return {
    payments: {
      provider: "Paystack",
      configured: paystackKey.length > 0,
      mode: paystackKey.startsWith("sk_live_") ? "LIVE" : paystackKey.startsWith("sk_test_") ? "TEST" : "NOT_CONFIGURED",
      publicKeyConfigured: !!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    },
    email: {
      provider: process.env.RESEND_API_KEY ? "Resend" : null,
      configured: !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
    },
    storage: {
      driver: process.env.STORAGE_DRIVER ?? "local",
    },
  } as const;
}
