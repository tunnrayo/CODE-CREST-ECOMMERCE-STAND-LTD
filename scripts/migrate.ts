import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, getPool } from "../src/server/db";

async function main() {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.log("✓ Database migrations applied");
  await getPool().end();
}
main().catch(async (e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
