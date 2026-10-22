import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "./auth/current";
import { CART_COOKIE, resolveCart } from "./services/cart";

/** Resolve (and optionally create) the cart for the current request, maintaining the cart cookie. */
export async function currentCartId(create = false): Promise<string | null> {
  const jar = await cookies();
  const user = await getCurrentUser();
  const cookieId = jar.get(CART_COOKIE)?.value;
  const id = await resolveCart(cookieId, user?.id ?? null, create);
  if (id && id !== cookieId) {
    // Cookies can only be written in Route Handlers / Server Actions; ignore during page render.
    try {
      jar.set(CART_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true", path: "/", maxAge: 60 * 60 * 24 * 60 });
    } catch {
      /* read-only context */
    }
  }
  return id;
}
