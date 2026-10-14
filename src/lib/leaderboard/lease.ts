import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

const LEASE_KEY = "snapshot_lease";

/**
 * How long a snapshot may hold the lease before another caller can take it over. It must be
 * longer than the snapshot route's `maxDuration` (60 seconds): Vercel stops the function there
 * without running its `finally`, so a lease shorter than that could expire under a run that is
 * still writing. `lease.test.ts` checks the two against each other.
 */
export const SNAPSHOT_LEASE_SECONDS = 120;

export type LeaseResult<T> = { ran: true; value: T } | { ran: false; heldSince: string | null };

/**
 * Runs `work` only if no other snapshot is running, so two schedulers calling at once cannot
 * both add the same arriving player. Nothing else stops that: `players.name` is not unique, and
 * each run reads the board and decides who is new before writing.
 *
 * The decision is made in the write. The insert either creates the lease, replaces one that
 * has expired, or touches nothing and returns no row, which is atomic in Postgres whatever
 * the interleaving. Time comes from the database, so two serverless instances never compare
 * clocks. Advisory locks do not fit: a session lock needs one connection for the whole request,
 * which Supabase's transaction pooler does not give, and a transaction lock (what the schema
 * setup uses) ends with its transaction, while a snapshot is several transactions with network
 * fetches between them.
 */
export async function withSnapshotLease<T>(work: () => Promise<T>): Promise<LeaseResult<T>> {
  const db = await getDb();
  const token = randomUUID();
  const taken = await db.query(
    `insert into meta (key, value, updated_at) values ($1, $2::text::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at
       where meta.updated_at < now() - ($3::int * interval '1 second')
     returning key`,
    [LEASE_KEY, JSON.stringify({ token }), SNAPSHOT_LEASE_SECONDS],
  );
  if (!taken.length) {
    const [held] = await db.query<{ updated_at: Date | string }>(`select updated_at from meta where key = $1`, [LEASE_KEY]);
    return { ran: false, heldSince: held ? new Date(held.updated_at).toISOString() : null };
  }
  try {
    return { ran: true, value: await work() };
  } finally {
    // Only our own lease: if this run outlived it and another caller took over, that one's stays.
    await db.query(`delete from meta where key = $1 and value->>'token' = $2`, [LEASE_KEY, token]);
  }
}
