import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, type Db } from "@/lib/db";
import type { FetchResult } from "./fetch";
import { runSnapshot } from "./ingest";

vi.mock("./fetch", () => ({ fetchBoard: vi.fn() }));
const { fetchBoard } = await import("./fetch");
const mocked = vi.mocked(fetchBoard);

/** Which season keys the last run actually went to the network for. */
const fetched = () => mocked.mock.calls.map(([ref]) => `${ref.year}-${String(ref.month).padStart(2, "0")}`);

const board = (names: string[]): FetchResult => ({
  ok: true,
  total: names.length,
  entries: names.map((name, i) => ({ rank: i + 1, name, score: 9000 - i * 10 })),
});
const empty: FetchResult = { ok: false, reason: "unavailable", detail: "Empty board" };

/** Answers per season key, so a run can serve October one thing and September another. */
function serve(byKey: Record<string, FetchResult>) {
  mocked.mockReset();
  mocked.mockImplementation(async (ref) => byKey[`${ref.year}-${String(ref.month).padStart(2, "0")}`] ?? empty);
}

let db: Db;
beforeEach(async () => {
  db = await getDb();
  await db.query(`truncate table history, standings, player_names, player_claims, players, snapshots restart identity`);
  await db.query(`delete from meta`);
});

const sept = new Date("2026-09-18T12:00:00Z");
const octFirst = new Date("2026-10-01T00:10:00Z");
const octLater = new Date("2026-10-01T09:00:00Z");

describe("the previous month is fetched once and then left alone", () => {
  it("fetches both months, then closes the finished one", async () => {
    serve({ "2026-09": board(["Alpha", "Bravo"]), "2026-08": board(["Carol"]) });
    const first = await runSnapshot(sept);
    expect(fetched().sort()).toEqual(["2026-08", "2026-09"]);
    expect(first.map((s) => `${s.season}:${s.status}`)).toEqual(["2026-09:updated", "2026-08:updated"]);

    // August is final and stored, so the next run does not ask for it again.
    serve({ "2026-09": board(["Alpha", "Bravo"]), "2026-08": board(["Carol"]) });
    const second = await runSnapshot(new Date(sept.getTime() + 600_000));
    expect(fetched()).toEqual(["2026-09"]);
    expect(second.map((s) => `${s.season}:${s.status}`)).toEqual(["2026-09:unchanged", "2026-08:skipped"]);
  });

  it("keeps the finished month's rows while the new one is tracked", async () => {
    serve({ "2026-09": board(["Alpha", "Bravo"]), "2026-08": board(["Carol"]) });
    await runSnapshot(sept);

    const augustBefore = await db.query(`select * from standings where season = '2026-08'`);
    serve({ "2026-09": board(["Alpha", "Bravo", "Dave"]), "2026-08": board(["Carol"]) });
    await runSnapshot(new Date(sept.getTime() + 600_000));

    expect(await db.query(`select * from standings where season = '2026-08'`)).toEqual(augustBefore);
  });
});

describe("the turn of the month", () => {
  it("does not close the old month until the new one has a board", async () => {
    // September tracked all month, August already closed.
    serve({ "2026-09": board(["Alpha", "Bravo"]), "2026-08": board(["Carol"]) });
    await runSnapshot(sept);

    // Midnight on the first: October has nobody at Infinite yet.
    serve({ "2026-10": empty, "2026-09": board(["Alpha", "Bravo"]) });
    const turn = await runSnapshot(octFirst);
    expect(fetched().sort()).toEqual(["2026-09", "2026-10"]);
    expect(turn.map((s) => `${s.season}:${s.status}`)).toEqual(["2026-10:unavailable", "2026-09:unchanged"]);

    // Still open, because nothing has proved September is over.
    expect(await db.query(`select 1 from meta where key = 'season_closed:2026-09:global'`)).toEqual([]);

    // Later that day somebody hits Infinite in October. Now September is definitively done.
    serve({ "2026-10": board(["Alpha"]), "2026-09": board(["Alpha", "Bravo"]) });
    const proved = await runSnapshot(octLater);
    expect(fetched().sort()).toEqual(["2026-09", "2026-10"]);
    expect(proved.map((s) => `${s.season}:${s.status}`)).toEqual(["2026-10:updated", "2026-09:unchanged"]);
    expect(await db.query(`select 1 from meta where key = 'season_closed:2026-09:global'`)).toHaveLength(1);

    // And from here on October is the only board fetched.
    serve({ "2026-10": board(["Alpha", "Erin"]), "2026-09": board(["Alpha", "Bravo"]) });
    const after = await runSnapshot(new Date(octLater.getTime() + 600_000));
    expect(fetched()).toEqual(["2026-10"]);
    expect(after.map((s) => `${s.season}:${s.status}`)).toEqual(["2026-10:updated", "2026-09:skipped"]);
  });

  it("leaves both finished months saved and readable", async () => {
    serve({ "2026-09": board(["Alpha", "Bravo"]), "2026-08": board(["Carol"]) });
    await runSnapshot(sept);
    serve({ "2026-10": board(["Alpha"]), "2026-09": board(["Alpha", "Bravo"]) });
    await runSnapshot(octLater);

    const { listSeasons } = await import("./queries");
    expect(await listSeasons("global")).toEqual(["2026-10", "2026-09", "2026-08"]);
    // Nobody is marked as having left a finished board just because the month moved on.
    const gone = await db.query(`select season from standings where not on_board`);
    expect(gone).toEqual([]);
  });

  it("asks for December of the year before when January turns over", async () => {
    serve({ "2027-01": board(["Alpha"]), "2026-12": board(["Bravo"]) });
    await runSnapshot(new Date("2027-01-03T00:00:00Z"));
    expect(fetched().sort()).toEqual(["2026-12", "2027-01"]);
  });

  it("retries the finished month for as long as the fetch keeps failing", async () => {
    serve({ "2026-09": board(["Alpha"]), "2026-08": { ok: false, reason: "error", detail: "500" } });
    await runSnapshot(sept);
    expect(await db.query(`select 1 from meta where key = 'season_closed:2026-08:global'`)).toEqual([]);

    serve({ "2026-09": board(["Alpha"]), "2026-08": board(["Carol"]) });
    await runSnapshot(new Date(sept.getTime() + 600_000));
    expect(fetched().sort()).toEqual(["2026-08", "2026-09"]);
    expect(await db.query(`select 1 from meta where key = 'season_closed:2026-08:global'`)).toHaveLength(1);
  });
});
