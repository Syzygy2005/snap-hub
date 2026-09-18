import { cleanEnv } from "@/lib/env";
import { SCHEMA } from "./schema";

export type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
}

/**
 * Where PGlite keeps its files. A directory only makes sense on a machine with a writable
 * disk; a serverless deployment with no DATABASE_URL has neither, and every request would
 * die on the mkdir rather than on anything to do with the query. Falling back to an
 * in-memory database keeps such a deployment standing, empty, and says so in the log,
 * because an empty database is a misconfiguration and not something to hide.
 *
 * A URL-shaped value (memory://, idb://) is PGlite's own and never touches the filesystem.
 */
async function pgliteDir(): Promise<string> {
  const dir = process.env.PGLITE_DIR || ".data/pglite";
  if (dir.includes("://")) return dir;
  try {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
    return dir;
  } catch (err) {
    console.warn(
      `[db] No DATABASE_URL, and ${dir} is not writable (${err instanceof Error ? err.message : String(err)}). ` +
        `Falling back to an in-memory database: nothing written will survive the request. ` +
        `Set DATABASE_URL, or PGLITE_DIR to a writable path or memory://, to stop seeing this.`,
    );
    return "memory://";
  }
}

// DATABASE_URL set  -> real Postgres (Supabase in production).
// DATABASE_URL unset -> PGlite, an embedded Postgres stored in .data/pglite. No install needed.
async function connect(): Promise<Db> {
  const url = cleanEnv("DATABASE_URL");

  if (url) {
    const { default: postgres } = await import("postgres");
    // Hosted databases (Supabase) get TLS; a local server or an explicit ?sslmode= in the URL decides for itself.
    let local = false;
    let sslmode = false;
    try {
      const parsed = new URL(url);
      local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
      sslmode = parsed.searchParams.has("sslmode");
    } catch {
      // postgres.js parses more loosely than URL(); let it report anything truly malformed.
    }
    const ssl = local || sslmode ? undefined : ("require" as const);
    // prepare:false keeps us compatible with Supabase's transaction pooler (port 6543).
    // onnotice: silence "relation already exists, skipping" from the idempotent schema on every cold start.
    const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {}, ssl });
    type Sql = typeof sql;
    const wrap = (s: Pick<Sql, "unsafe">): Db => ({
      query: async <T,>(text: string, params: unknown[] = []) =>
        (await s.unsafe(text, params.map(toPgParam) as never[])) as unknown as T[],
      transaction: () => {
        throw new Error("Nested transactions are not supported");
      },
    });
    // Several serverless instances can start at once; concurrent "create table if not exists" can collide,
    // so the schema runs in one transaction behind an advisory lock (safe with the transaction pooler).
    await sql.begin(async (tx) => {
      await tx.unsafe("select pg_advisory_xact_lock(727274)");
      await tx.unsafe(SCHEMA).simple();
    });
    return {
      ...wrap(sql),
      transaction: async (fn) => (await sql.begin((tx) => fn(wrap(tx)))) as never,
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(await pgliteDir());
  await pg.exec(SCHEMA);
  return {
    query: async <T,>(text: string, params: unknown[] = []) =>
      (await pg.query<T>(text, params)).rows,
    transaction: (fn) =>
      pg.transaction((tx) =>
        fn({
          query: async <T,>(text: string, params: unknown[] = []) =>
            (await tx.query<T>(text, params)).rows,
          transaction: () => {
            throw new Error("Nested transactions are not supported");
          },
        }),
      ),
  };
}

// postgres.js labels an array parameter with its first element's type (e.g. a boolean[] is sent
// as boolean), which the server rejects. Sending arrays as untyped array literals lets the
// explicit casts in our SQL ($1::bool[], $2::int[]) decide the type instead.
export function toPgParam(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const items = value.map((v) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "boolean") return v ? "t" : "f";
    if (typeof v === "number") return String(v);
    return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  });
  return `{${items.join(",")}}`;
}

/** Internals reached by tests only. */
export const __test = { pgliteDir };

// One connection per process; survives dev-server hot reloads.
const g = globalThis as unknown as { __snapDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__snapDb) {
    g.__snapDb = connect().catch((err) => {
      g.__snapDb = undefined;
      throw err;
    });
  }
  return g.__snapDb;
}
