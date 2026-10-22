import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** GET /api/health — liveness + database connectivity. Exposes no secrets or configuration values. */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    database = "error";
  }
  const status = database === "ok" ? "ok" : "degraded";
  return NextResponse.json({ status, database, uptimeSeconds: Math.round(process.uptime()), responseMs: Date.now() - started, time: new Date().toISOString() }, { status: status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
