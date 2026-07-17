import postgres from "postgres";
import { DATABASE_URL } from "./config";

// Supabase Supavisor transaction pooler: prepared statements must be off,
// and we keep the pool tiny since serverless instances multiply.
const globalForDb = globalThis as unknown as {
  pgsql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.pgsql ??
  (globalForDb.pgsql = postgres(DATABASE_URL, {
    ssl: "require",
    max: 4,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  }));
