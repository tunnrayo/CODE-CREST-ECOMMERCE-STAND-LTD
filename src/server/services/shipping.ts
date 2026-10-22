import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { shippingMethods, shippingZones } from "../db/schema";

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT - Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;

export type ShippingOption = {
  id: string;
  name: string;
  description: string | null;
  zoneName: string;
  feeKobo: number | null;
  feeConfirmed: boolean;
  freeOverKobo: number | null;
  estimatedDeliveryText: string | null;
};

export async function shippingOptionsFor(country: string, state: string): Promise<ShippingOption[]> {
  const rows = await db
    .select({ m: shippingMethods, z: shippingZones })
    .from(shippingMethods)
    .innerJoin(shippingZones, eq(shippingZones.id, shippingMethods.zoneId))
    .where(and(eq(shippingMethods.isActive, true), eq(shippingZones.isActive, true)))
    .orderBy(asc(shippingMethods.position), asc(shippingMethods.name));
  return rows
    .filter(({ z }) => z.countries.includes(country) && (z.states.length === 0 || z.states.includes(state)))
    .map(({ m, z }) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      zoneName: z.name,
      feeKobo: m.feeKobo,
      feeConfirmed: m.feeConfirmed && m.feeKobo != null,
      freeOverKobo: m.freeOverKobo,
      estimatedDeliveryText: m.estimatedDeliveryText,
    }));
}

/** Returns the fee to charge, or null when the fee is not yet confirmed. */
export function shippingFeeFor(option: ShippingOption, subtotalKobo: number): number | null {
  if (!option.feeConfirmed || option.feeKobo == null) return null;
  if (option.freeOverKobo != null && subtotalKobo >= option.freeOverKobo) return 0;
  return option.feeKobo;
}

export const zoneSchema = z.object({
  name: z.string().trim().min(2).max(80),
  countries: z.array(z.string().length(2)).min(1),
  states: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});
export const methodSchema = z.object({
  zoneId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).nullable().optional(),
  feeKobo: z.number().int().min(0).nullable(),
  feeConfirmed: z.boolean(),
  freeOverKobo: z.number().int().min(0).nullable().optional(),
  estimatedDeliveryText: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean().default(true),
  position: z.number().int().default(0),
});

export async function listZonesWithMethods() {
  const zones = await db.select().from(shippingZones).orderBy(asc(shippingZones.name));
  const methods = await db.select().from(shippingMethods).orderBy(asc(shippingMethods.position));
  return zones.map((z) => ({ ...z, methods: methods.filter((m) => m.zoneId === z.id) }));
}
