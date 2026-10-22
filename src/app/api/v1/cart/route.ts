import { currentCartId } from "@/server/cart-context";
import { ok, route } from "@/server/http";
import { getCartView } from "@/server/services/cart";

export const dynamic = "force-dynamic";

/** GET /api/v1/cart — current cart with server-calculated prices. */
export const GET = route(async () => ok(await getCartView(await currentCartId(false))));
