import { getCurrentUser } from "@/server/auth/current";
import { can } from "@/server/auth/core";
import { notFound, ok, route } from "@/server/http";
import { getOrderForViewer } from "@/server/services/orders";

export const dynamic = "force-dynamic";

/** GET /api/v1/orders/:reference?token=… — owner, token holder or staff only. */
export const GET = route<{ reference: string }>(async (req, { params }) => {
  const user = await getCurrentUser();
  const order = await getOrderForViewer(params.reference, { token: req.nextUrl.searchParams.get("token"), userId: user?.id, isStaff: can(user?.role, "orders:read") });
  if (!order) throw notFound("Order not found");
  return ok({ ...order, transactions: order.transactions.map((t) => ({ reference: t.reference, status: t.status, amountKobo: t.amountKobo, provider: t.provider, createdAt: t.createdAt })) });
});
