import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { maxDuration } from "@/app/api/cron/snapshot/route";
import { SNAPSHOT_LEASE_SECONDS, withSnapshotLease } from "./lease";

const leaseRows = async () => (await getDb()).query<{ value: { token: string } }>(`select value from meta where key = 'snapshot_lease'`);

/** A promise the test resolves by hand, so one run can be held open while another arrives. */
function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => { open = resolve; });
  return { open, opened };
}

beforeEach(async () => {
  await (await getDb()).query(`delete from meta where key = 'snapshot_lease'`);
});

describe("snapshot lease", () => {
  it("outlasts the longest run Vercel allows", () => {
    expect(SNAPSHOT_LEASE_SECONDS).toBeGreaterThan(maxDuration);
  });

  it("lets only one of two simultaneous callers run", async () => {
    const hold = gate();
    let runs = 0;
    const work = async () => { runs++; await hold.opened; return "done"; };
    let settled = 0;
    const calls = [withSnapshotLease(work), withSnapshotLease(work)].map((call) => call.finally(() => { settled++; }));
    // Release the winner only once the other caller has been turned away. Opening the gate
    // earlier lets a caller whose connection was slow to open arrive after the lease is gone,
    // which is two runs one after the other, not an overlap; on real Postgres that is what
    // happened before this wait was added.
    while (runs === 0 || settled === 0) await new Promise((resolve) => setTimeout(resolve, 5));
    hold.open();
    const results = await Promise.all(calls);
    expect(runs).toBe(1);
    expect(results.filter((r) => r.ran)).toEqual([{ ran: true, value: "done" }]);
    const skipped = results.find((r) => !r.ran);
    expect(skipped && !skipped.ran && skipped.heldSince).toBeTruthy();
  });

  it("is released when the run finishes, and when it throws", async () => {
    await withSnapshotLease(async () => "ok");
    expect(await leaseRows()).toHaveLength(0);
    await expect(withSnapshotLease(async () => { throw new Error("source down"); })).rejects.toThrow("source down");
    expect(await leaseRows()).toHaveLength(0);
    expect((await withSnapshotLease(async () => 1)).ran).toBe(true);
  });

  it("is taken over once it has expired, so a run Vercel stopped cannot block every later one", async () => {
    const db = await getDb();
    await db.query(
      `insert into meta (key, value, updated_at) values ('snapshot_lease', '{"token":"stopped-run"}'::jsonb, now() - ($1::int * interval '1 second'))`,
      [SNAPSHOT_LEASE_SECONDS + 1],
    );
    expect((await withSnapshotLease(async () => "took over")).ran).toBe(true);
  });

  it("is not taken over while it is still within its time", async () => {
    const db = await getDb();
    await db.query(
      `insert into meta (key, value, updated_at) values ('snapshot_lease', '{"token":"live-run"}'::jsonb, now() - ($1::int * interval '1 second'))`,
      [SNAPSHOT_LEASE_SECONDS - 5],
    );
    expect((await withSnapshotLease(async () => "should not run")).ran).toBe(false);
  });

  it("never releases a lease another caller took over after this one expired", async () => {
    const hold = gate();
    let slowInside = false;
    const slow = withSnapshotLease(async () => { slowInside = true; await hold.opened; });
    while (!slowInside) await new Promise((resolve) => setTimeout(resolve, 5));
    // The slow run's lease expires under it and a new caller takes over.
    const db = await getDb();
    await db.query(`update meta set updated_at = now() - ($1::int * interval '1 second') where key = 'snapshot_lease'`, [SNAPSHOT_LEASE_SECONDS + 1]);
    const hold2 = gate();
    let takeoverInside = false;
    const takeover = withSnapshotLease(async () => { takeoverInside = true; await hold2.opened; });
    while (!takeoverInside) await new Promise((resolve) => setTimeout(resolve, 5));
    hold.open();
    await slow;
    // The slow run's release must leave the takeover's lease in place.
    expect(await leaseRows()).toHaveLength(1);
    expect((await withSnapshotLease(async () => "blocked")).ran).toBe(false);
    hold2.open();
    await takeover;
    expect(await leaseRows()).toHaveLength(0);
  });
});
