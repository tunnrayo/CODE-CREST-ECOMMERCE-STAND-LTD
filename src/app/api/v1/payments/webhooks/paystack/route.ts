import { NextResponse, type NextRequest } from "next/server";
import { handlePaystackWebhook } from "@/server/services/payments";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/payments/webhooks/paystack
 * Authenticated by HMAC-SHA512 signature (x-paystack-signature). No cookies/CSRF.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 200_000) return NextResponse.json({ ok: false }, { status: 413 });
  try {
    const r = await handlePaystackWebhook(raw, req.headers.get("x-paystack-signature"));
    return NextResponse.json({ ok: r.status === 200, result: r.status === 200 ? r.result : undefined }, { status: r.status });
  } catch (e) {
    console.error("[webhook] paystack", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
