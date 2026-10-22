import { z } from "zod";
import { requireUser } from "@/server/auth/current";
import { ok, readJson, route } from "@/server/http";
import { toggleWishlist, wishlistFor } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

/** GET /api/v1/wishlist — signed-in customer's saved product ids. */
export const GET = route(async () => {
  const u = await requireUser();
  return ok((await wishlistFor(u.id)).map((w) => w.productId));
});

/** POST /api/v1/wishlist — toggle a product. Body: { productId } */
export const POST = route(async (req) => {
  const u = await requireUser();
  const { productId } = z.object({ productId: z.string().uuid() }).parse(await readJson(req));
  const saved = await toggleWishlist(u.id, productId);
  return ok({ productId, saved });
});
