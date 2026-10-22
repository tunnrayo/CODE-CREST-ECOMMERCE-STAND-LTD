import { endSession } from "@/server/auth/current";
import { ok, route } from "@/server/http";

/** POST /api/v1/auth/logout */
export const POST = route(async () => {
  await endSession();
  return ok({ signedOut: true });
});
