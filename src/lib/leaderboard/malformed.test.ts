import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, type Db } from "@/lib/db";
import { ingestBoard, runSnapshot } from "./ingest";
import { lastBoardCheck } from "./queries";

// The real fetchBoard against a stubbed source, so these cover the whole path from the
// response body to what is stored, not a hand-built FetchResult.
const good = [
  { rank: 0, playerName: "Alpha", score: 9000 },
  { rank: 1, playerName: "Bravo", score: 8990 },
  { rank: 2, playerName: "Carol", score: 8980 },
];

/** October answers with `october`; September is empty, so it is skipped as unavailable. */
function source(october: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) =>
    Response.json(new URL(url).searchParams.get("month") === "10" ? october : { results: [] })));
}

const onBoard = async () => (await db.query<{ name: string; on_board: boolean }>(
  `select p.name, s.on_board from standings s join players p on p.id = s.player_id
    where s.season = '2026-10' order by p.name`));
const historyRows = async () => (await db.query(`select 1 from history where season = '2026-10'`)).length;

let db: Db;
beforeEach(async () => {
  db = await getDb();
  await db.query(`truncate table history, standings, player_names, player_claims, players, snapshots restart identity`);
  await db.query(`delete from meta`);
});
afterEach(() => vi.unstubAllGlobals());

const first = new Date("2026-10-14T12:00:00Z");
const next = new Date("2026-10-14T12:10:00Z");

describe("a malformed board from the source", () => {
  it("keeps the last good board when one row is bad, rather than reading that player as gone", async () => {
    source({ total: 3, results: good });
    await runSnapshot(first);
    const before = await onBoard();
    const history = await historyRows();

    source({ total: 3, results: [good[0], good[1], { ...good[2], score: "8980" }] });
    const run = await runSnapshot(next);

    expect(run.find((s) => s.season === "2026-10")).toMatchObject({ status: "error", detail: expect.stringContaining('row 2 has score "8980"') });
    expect(await onBoard()).toEqual(before);
    expect(before.every((p) => p.on_board)).toBe(true);
    expect(await historyRows()).toBe(history);
    expect(await lastBoardCheck("2026-10", "global")).toBe(first.toISOString());
  });

  it("does not empty the board and mark it fresh when every row is bad", async () => {
    source({ total: 3, results: good });
    await runSnapshot(first);
    const before = await onBoard();

    source({ total: 3, results: good.map((r) => ({ ...r, score: String(r.score) })) });
    const run = await runSnapshot(next);

    expect(run.find((s) => s.season === "2026-10")?.status).toBe("error");
    expect(await onBoard()).toEqual(before);
    expect(await lastBoardCheck("2026-10", "global")).toBe(first.toISOString());
  });

  it("is refused by ingest too, so no other caller can store an empty board", async () => {
    await expect(ingestBoard(db, { year: 2026, month: 10 }, "global", [], 0, next)).rejects.toThrow("An empty board is not a snapshot");
  });
});
