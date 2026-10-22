import { clientIp, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { submitContactMessage } from "@/server/services/accounts";

/** POST /api/v1/contact — { name, email, subject, message } (stored; emailed only if email is configured) */
export const POST = route(async (req) => {
  if (!rateLimit(`contact:${clientIp(req)}`, 5, 10 * 60_000).allowed) throw tooMany();
  const r = await submitContactMessage((await readJson(req)) as never);
  return ok({ received: true, notification: r.emailStatus === "SENT" ? "sent" : r.emailStatus === "NOT_CONFIGURED" ? "email-not-configured" : "email-failed" }, { status: 201 });
});
