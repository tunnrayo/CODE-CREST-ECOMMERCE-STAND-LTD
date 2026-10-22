/**
 * Creates (or resets the password of) the initial administrator.
 * Credentials come ONLY from environment variables — nothing is hardcoded:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME (optional)
 * Usage: npm run admin:create
 * After first login you can remove ADMIN_PASSWORD from your environment.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb, getPool } from "../src/server/db";
import { users } from "../src/server/db/schema";
import { destroyAllSessions, findUserByEmail, hashPassword, normaliseEmail, validatePasswordStrength } from "../src/server/auth/core";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Code Crest Admin";
  if (!email || !password) {
    console.log("ℹ ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin creation.");
    await getPool().end();
    return;
  }
  const err = validatePasswordStrength(password);
  if (err) throw new Error(`ADMIN_PASSWORD rejected: ${err}`);
  const db = getDb();
  const existing = await findUserByEmail(email);
  const passwordHash = await hashPassword(password);
  if (existing) {
    await db.update(users).set({ role: "ADMIN", passwordHash, isActive: true, failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, existing.id));
    await destroyAllSessions(existing.id);
    console.log(`✓ Administrator updated: ${normaliseEmail(email)}`);
  } else {
    await db.insert(users).values({ email: normaliseEmail(email), name, role: "ADMIN", passwordHash });
    console.log(`✓ Administrator created: ${normaliseEmail(email)}`);
  }
  await getPool().end();
}

main().catch(async (e) => {
  console.error(e.message);
  process.exit(1);
});
