import { beforeAll, describe, expect, it } from "vitest";
import { getDb, type Db } from "@/lib/db";
import { ingestBoard } from "./ingest";
import { getBoard, getMovers, getPlayerHistory, searchPlayers } from "./queries";

const season = { year: 2026, month: 9 };
const t0 = new Date("2026-09-10T00:00:00Z");
const hours = (h: number) => new Date(t0.getTime() + h * 3600_000);

let db: Db;
beforeAll(async () => {
  db = await getDb();
});

describe("ingestBoard", () => {
  it("tracks ranks over time, shared names, drop-outs and movers", async () => {
    await ingestBoard(
      db,
      season,
      "global",
      [
        { rank: 1, name: "Alpha", score: 9000 },
        { rank: 2, name: "Ghost", score: 8800 },
        { rank: 3, name: "Bravo", score: 8500 },
        { rank: 4, name: "Ghost", score: 8000 },
      ],
      36000,
      t0,
    );

    // Same board again: nothing written.
    const same = await ingestBoard(
      db,
      season,
      "global",
      [
        { rank: 1, name: "Alpha", score: 9000 },
        { rank: 2, name: "Ghost", score: 8800 },
        { rank: 3, name: "Bravo", score: 8500 },
        { rank: 4, name: "Ghost", score: 8000 },
      ],
      36000,
      hours(1),
    );
    expect(same.status).toBe("unchanged");

    // 30 hours later: lower Ghost climbs past Bravo, Alpha drops off, Charlie enters.
    const next = await ingestBoard(
      db,
      season,
      "global",
      [
        { rank: 1, name: "Ghost", score: 8820 },
        { rank: 2, name: "Ghost", score: 8600 },
        { rank: 3, name: "Bravo", score: 8500 },
        { rank: 4, name: "Charlie", score: 8400 },
      ],
      36010,
      hours(30),
    );
    expect(next).toMatchObject({ status: "updated", newPlayers: 1, left: 1 });

    const { rows, meta } = await getBoard("2026-09", "global", 24);
    expect(meta.totalPlayers).toBe(36010);
    expect(rows.map((r) => [r.rank, r.name])).toEqual([
      [1, "Ghost"],
      [2, "Ghost"],
      [3, "Bravo"],
      [4, "Charlie"],
    ]);
    expect(rows[0].sharedName).toBe(true);

    const lowGhost = rows[1];
    expect(lowGhost.pastRank).toBe(4);
    expect(lowGhost.bestRank).toBe(2);
    expect(rows[3].isNew).toBe(true);

    const history = await getPlayerHistory(lowGhost.id, "2026-09", "global");
    expect(history.map((h) => [h.rank, h.score])).toEqual([
      [4, 8000],
      [2, 8600],
    ]);

    const movers = await getMovers("2026-09", "global", 24);
    expect(movers.climbers.map((r) => r.id)).toContain(lowGhost.id);
    expect(movers.droppedOut.map((r) => r.name)).toEqual(["Alpha"]);
    expect(movers.newEntries.map((r) => r.name)).toEqual(["Charlie"]);

    const found = await searchPlayers("gho");
    expect(found).toHaveLength(2);
  });
});

describe("renames", () => {
  const s = { year: 2026, month: 11 };
  const start = new Date("2026-11-01T00:00:00Z");
  const later = (h: number) => new Date(start.getTime() + h * 3600_000);

  it("keeps a renamed player on their own row, with the old name recorded", async () => {
    await ingestBoard(
      db,
      s,
      "global",
      [
        { rank: 1, name: "Steady", score: 9000 },
        { rank: 2, name: "PXL D. Rick", score: 4200 },
      ],
      1000,
      start,
    );
    const before = await getBoard("2026-11", "global");
    const rick = before.rows.find((r) => r.name === "PXL D. Rick")!;
    expect(rick).toBeDefined();

    // Same score, new name: a rename, not a departure plus a stranger.
    await ingestBoard(
      db,
      s,
      "global",
      [
        { rank: 1, name: "Steady", score: 9000 },
        { rank: 2, name: "PXL Rick", score: 4200 },
      ],
      1000,
      later(1),
    );

    const after = await getBoard("2026-11", "global");
    const renamed = after.rows.find((r) => r.name === "PXL Rick")!;
    expect(renamed.id).toBe(rick.id);
    expect(renamed.isNew).toBe(false);
    expect(renamed.renamedFrom).toBe("PXL D. Rick");
    expect(after.rows.some((r) => r.name === "PXL D. Rick")).toBe(false);

    // Their history came with them rather than starting over.
    const history = await getPlayerHistory(rick.id, "2026-11", "global");
    expect(history.length).toBeGreaterThan(0);

    const { getPlayer } = await import("./queries");
    const profile = await getPlayer(rick.id);
    expect(profile?.name).toBe("PXL Rick");
    expect(profile?.formerNames.map((n) => n.name)).toEqual(["PXL D. Rick"]);
  });

  it("does not merge two players who merely swapped places", async () => {
    const s2 = { year: 2026, month: 12 };
    await ingestBoard(
      db,
      s2,
      "global",
      [
        { rank: 1, name: "Keeper", score: 9000 },
        { rank: 2, name: "Leaver", score: 5000 },
      ],
      1000,
      start,
    );
    // Leaver goes, a stranger arrives on a different score: no evidence of a rename.
    await ingestBoard(
      db,
      s2,
      "global",
      [
        { rank: 1, name: "Keeper", score: 9000 },
        { rank: 2, name: "Stranger", score: 4999 },
      ],
      1000,
      later(1),
    );
    const board = await getBoard("2026-12", "global");
    const stranger = board.rows.find((r) => r.name === "Stranger")!;
    expect(stranger.renamedFrom).toBeNull();

    // Leaver keeps their own row and their own name; getBoard only lists players still on
    // the board, so look them up directly rather than expecting them in the rows.
    const rows = await db.query<{ id: number }>(`select id from players where name = 'Leaver'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(stranger.id);
    const names = await db.query<{ n: number }>(
      `select count(*)::int as n from player_names where player_id = $1`,
      [rows[0].id],
    );
    expect(names[0].n).toBe(0);
  });
});
