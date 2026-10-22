import { db, type Tx } from "../db";
import { auditLogs } from "../db/schema";

export type Actor = { id: string; email: string } | null | undefined;

export async function audit(
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
  tx?: Tx,
) {
  const runner = tx ?? db;
  try {
    await runner.insert(auditLogs).values({
      actorUserId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action,
      entityType,
      entityId,
      details: details ?? null,
    });
  } catch (e) {
    console.error("[audit] failed to write audit log", e);
  }
}
