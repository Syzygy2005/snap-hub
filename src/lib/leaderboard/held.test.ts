import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, type Db } from "@/lib/db";
import { HOLD_MINUTES, runSnapshot, SUSPECT_DEPARTURES } from "./ingest";
import { lastBoardCheck } from "./queries";

// The real fetchBoard against a stubbed source, shaped like the bad boards seen in October
// 2026: the top of the board right, a block at the bottom swapped for other players.
const SIZE = 120;
const base = Array.from({ length: SIZE }, (_, i) => ({ rank: i, playerName: `Player ${i}`, score: 9000 - i }));
/** The bottom `n` rows replaced by players nobody stored, scored well apart so nothing pairs as a rename. */
const swapped = (n: number) => [
  ...base.slice(0, SIZE - n),
  ...Array.from({ length: n }, (_, j) => ({ rank: SIZE - n + j, playerName: `Stale ${j}`, score: 5000 - j })),
];

function source(results: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) =>
    Response.json(new URL(url).searchParams.get("month") === "10" ? { total: SIZE, results } : { results: [] })));
}
const october = (run: Awaited<ReturnType<typeof runSnapshot>>) => run.find((s) => s.season === "2026-10")!;
const offBoard = async () => (await db.query(`select 1 from standings where season = '2026-10' and not on_board`)).length;
const historyRows = async () => (await db.query(`select 1 from history where season = '2026-10'`)).length;
const holdRow = async () => db.query(`select 1 from meta where key = 'board_held:2026-10:global'`);

let db: Db;
beforeEach(async () => {
  db = await getDb();
  await db.query(`truncate table history, standings, player_names, player_claims, players, snapshots restart identity`);
  await db.query(`delete from meta`);
});
afterEach(() => vi.unstubAllGlobals());

const t0 = new Date("2026-10-14T20:00:00Z");
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

describe("a board that would remove a block of players at once", () => {
  it("is held, and the next normal board clears it without anyone having left", async () => {
    source(base);
    await runSnapshot(t0);
    const history = await historyRows();

    source(swapped(SUSPECT_DEPARTURES + 10));
    const bad = october(await runSnapshot(at(10)));
    expect(bad).toMatchObject({ status: "held", left: SUSPECT_DEPARTURES + 10 });
    expect(await offBoard()).toBe(0);
    expect(await historyRows()).toBe(history);
    // Not a successful check of the board, so freshness does not move.
    expect(await lastBoardCheck("2026-10", "global")).toBe(t0.toISOString());

    source(base);
    expect(october(await runSnapshot(at(20))).status).toBe("unchanged");
    expect(await holdRow()).toHaveLength(0);
    expect(await offBoard()).toBe(0);
    expect(await historyRows()).toBe(history);
    expect(await lastBoardCheck("2026-10", "global")).toBe(at(20).toISOString());
  });

  it("is stored once it has lasted the whole wait, because then it is real", async () => {
    source(base);
    await runSnapshot(t0);
    source(swapped(SUSPECT_DEPARTURES + 10));
    // The wait runs from the first suspect board; later ones do not restart it.
    for (const minutes of [10, 40, 10 + HOLD_MINUTES - 1]) {
      expect(october(await runSnapshot(at(minutes))).status).toBe("held");
    }
    const stored = october(await runSnapshot(at(10 + HOLD_MINUTES)));
    expect(stored).toMatchObject({ status: "updated", left: SUSPECT_DEPARTURES + 10, newPlayers: SUSPECT_DEPARTURES + 10 });
    expect(await offBoard()).toBe(SUSPECT_DEPARTURES + 10);
    expect(await holdRow()).toHaveLength(0);
  });

  it("is stored straight away when fewer than that many leave", async () => {
    source(base);
    await runSnapshot(t0);
    source(swapped(SUSPECT_DEPARTURES - 1));
    expect(october(await runSnapshot(at(10)))).toMatchObject({ status: "updated", left: SUSPECT_DEPARTURES - 1 });
    expect(await holdRow()).toHaveLength(0);
  });
});
