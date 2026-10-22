import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __ccPool: Pool | undefined;
}

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL.");
  return new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
  });
}

export function getPool(): Pool {
  if (!globalThis.__ccPool) globalThis.__ccPool = createPool();
  return globalThis.__ccPool;
}

export type DB = NodePgDatabase<typeof schema>;
let _db: DB | undefined;
export function getDb(): DB {
  if (!_db) _db = drizzle(getPool(), { schema });
  return _db;
}

/** Lazy proxy so importing this module never opens a connection at build time. */
export const db = new Proxy({} as DB, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
