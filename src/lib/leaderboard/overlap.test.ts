import { expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { runSnapshot } from "./ingest";
import { withSnapshotLease } from "./lease";

vi.mock("./fetch", () => ({ fetchBoard: vi.fn() }));
const { fetchBoard } = await import("./fetch");

// On real Postgres (the reference-postgres CI job), two runSnapshot calls left to overlap stored
// every new player twice: each transaction read the board before the other's inserts committed.
// PGlite runs one transaction at a time and cannot show it, so this only proves anything there.
it("stores each new player once when two scheduled calls overlap", async () => {
  const db = await getDb();
  await db.query(`truncate table history, standings, player_names, player_claims, players, snapshots restart identity`);
  await db.query(`delete from meta`);
  vi.mocked(fetchBoard).mockResolvedValue({
    ok: true,
    total: 3,
    entries: [
      { rank: 1, name: "Alpha", score: 9000 },
      { rank: 2, name: "Bravo", score: 8990 },
      { rank: 3, name: "Charlie", score: 8980 },
    ],
  });
  const now = new Date("2026-10-13T12:00:00Z");
  const runs = await Promise.all([withSnapshotLease(() => runSnapshot(now)), withSnapshotLease(() => runSnapshot(now))]);
  expect(runs.filter((run) => run.ran)).toHaveLength(1);
  const players = await db.query<{ name: string; n: number }>(`select name, count(*)::int as n from players group by name order by name`);
  expect(players).toEqual([{ name: "Alpha", n: 1 }, { name: "Bravo", n: 1 }, { name: "Charlie", n: 1 }]);
});
