import { z } from "zod";
import { ok, route } from "@/server/http";
import { NIGERIAN_STATES, shippingOptionsFor } from "@/server/services/shipping";

export const dynamic = "force-dynamic";

/** GET /api/v1/shipping/options?country=NG&state=Lagos */
export const GET = route(async (req) => {
  const sp = req.nextUrl.searchParams;
  const { country, state } = z.object({ country: z.literal("NG").default("NG"), state: z.enum(NIGERIAN_STATES) }).parse({ country: sp.get("country") ?? "NG", state: sp.get("state") });
  return ok(await shippingOptionsFor(country, state));
});
