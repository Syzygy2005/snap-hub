import { beforeAll, describe, expect, it } from "vitest";
import { getDb, type Db } from "@/lib/db";
import { ingestBoard } from "./ingest";
import { applyMerge, planMerge } from "./merge";
import { getPlayer, getPlayerHistory } from "./queries";

const t0 = new Date("2027-03-01T00:00:00Z");
const at = (h: number) => new Date(t0.getTime() + h * 3600_000);

let db: Db;
const idOf = async (name: string) => {
  const [row] = await db.query<{ id: number }>(`select id from players where name = $1`, [name]);
  return row.id;
};

beforeAll(async () => {
  db = await getDb();
});

describe("planMerge safety check", () => {
  it("refuses two players who were on the board at the same moment", async () => {
    const s = { year: 2027, month: 3 };
    await ingestBoard(
      db,
      s,
      "global",
      [
        { rank: 1, name: "Together A", score: 900 },
        { rank: 2, name: "Together B", score: 800 },
      ],
      1000,
      at(0),
    );

    const plan = await planMerge(await idOf("Together A"), await idOf("Together B"));
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toContain("both on the board");
  });

  it("refuses an id that isn't a player, and refuses merging a player into itself", async () => {
    const id = await idOf("Together A");
    expect(await planMerge(id, id)).toMatchObject({ ok: false });
    expect(await planMerge(id, 999_999)).toMatchObject({ ok: false });
    expect(await planMerge(999_999, id)).toMatchObject({ ok: false });
  });
});

describe("applyMerge", () => {
  it("joins two rows that were never on the board together", async () => {
    const s = { year: 2027, month: 4 };
    // The old name holds a rank, leaves, and only then does the new name appear, so they
    // never overlap. Different scores, so ingest does not pair them on its own.
    await ingestBoard(db, s, "global", [{ rank: 5, name: "Before", score: 700 }], 1000, at(24));
    await ingestBoard(db, s, "global", [{ rank: 9, name: "Filler", score: 100 }], 1000, at(25));
    await ingestBoard(db, s, "global", [{ rank: 4, name: "After", score: 640 }], 1000, at(26));

    const keepId = await idOf("After");
    const absorbId = await idOf("Before");
    const historyBefore = (await getPlayerHistory(keepId, "2027-04", "global")).length;

    const planned = await planMerge(keepId, absorbId);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.plan.historyRows).toBeGreaterThan(0);
    expect(planned.plan.seasonsCombined).toHaveLength(1);

    await applyMerge(planned.plan);

    const profile = await getPlayer(keepId);
    expect(profile?.name).toBe("After");
    expect(profile?.formerNames.map((n) => n.name)).toContain("Before");

    // The absorbed row is gone and its history came across.
    const gone = await db.query(`select id from players where id = $1`, [absorbId]);
    expect(gone).toHaveLength(0);
    expect((await getPlayerHistory(keepId, "2027-04", "global")).length).toBeGreaterThan(historyBefore);

    // One standings row for the season, carrying the best of both lives.
    const standings = await db.query<{ best_rank: number; peak_score: number; rank: number }>(
      `select best_rank, peak_score, rank from standings where player_id = $1 and season = '2027-04'`,
      [keepId],
    );
    expect(standings).toHaveLength(1);
    expect(standings[0].best_rank).toBe(4);
    expect(standings[0].peak_score).toBe(700);
    expect(standings[0].rank).toBe(4);
  });
});
