import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { getDb, type Db } from "@/lib/db";
import { ingestBoard } from "./ingest";

/**
 * scripts/cleanup-bad-boards-2026-10.sql is run by hand against production, once, and deletes
 * rows for good. This replays one bad board the way October's were stored, runs the preview and
 * the cleanup against it, and checks what goes, what is repaired and what must stay.
 */

const OCT = { year: 2026, month: 10 };
const at = (hhmm: string) => new Date(`2026-10-10T${hhmm}:00Z`);
const tA = at("10:00"), tB = at("11:00"), bad = at("12:00"), fixed = at("12:20"), tC = at("13:00");
const score = (i: number) => 3000 - 10 * i;
const P = (i: number, s = score(i)) => ({ name: `P${i}`, score: s });
const N = (k: number, s = 2745 - k) => ({ name: `N${k}`, score: s });
const ranked = (rows: { name: string; score: number }[], from = 1) => rows.map((r, i) => ({ rank: from + i, ...r }));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

let db: Db;
let cleanup: string;
let preview: string;

const BAD_BOARDS = `  ('2026-10', 'global', timestamptz '${bad.toISOString()}', timestamptz '${fixed.toISOString()}', 21)`;

/** Swaps the production list of bad boards for this test's one. */
function forTest(sql: string, list: string) {
  expect(sql).toContain(list);
  return sql.replace(list, BAD_BOARDS);
}

/** The SQL editor takes a file whole; here it goes a statement at a time, as in reset.test.ts. */
async function runScript(sql: string) {
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  let last: unknown[] = [];
  for (const statement of statements) last = await db.query(statement);
  return last;
}

const history = (id: number) => db.query<{ taken_at: Date; rank: number | null; score: number }>(
  `select taken_at, rank, score from history where player_id = $1 and season = '2026-10' order by taken_at`, [id]);
const standing = async (id: number) => (await db.query<{ rank: number; score: number; on_board: boolean; updated_at: Date; score_changed_at: Date; first_seen: Date }>(
  `select rank, score, on_board, updated_at, score_changed_at, first_seen from standings where player_id = $1 and season = '2026-10'`, [id]))[0];
const id = async (name: string) => (await db.query<{ id: number }>(`select id from players where name = $1`, [name]))[0]?.id;
const rowsAt = async (t: Date) => (await db.query(`select 1 from history where season = '2026-10' and taken_at = $1`, [t])).length;

beforeAll(async () => {
  db = await getDb();
  cleanup = await readFile("scripts/cleanup-bad-boards-2026-10.sql", "utf8");
  preview = await readFile("scripts/cleanup-bad-boards-2026-10-preview.sql", "utf8");

  // Somebody from September, so the bad board can reuse an earlier season's player row.
  await ingestBoard(db, { year: 2026, month: 9 }, "global", [{ rank: 1, name: "Sept Player", score: 1000 }], 1, new Date("2026-09-20T00:00:00Z"));

  await ingestBoard(db, OCT, "global", ranked(range(1, 30).map((i) => P(i))), 30, tA);
  // An hour later: P21 gains 5, P26 to P30 fall off and N1 to N5 arrive below.
  const real = [...range(1, 20).map((i) => P(i)), P(21, score(21) + 5), ...range(22, 25).map((i) => P(i)), ...range(1, 5).map((k) => N(k))];
  await ingestBoard(db, OCT, "global", ranked(real), 30, tB);

  // The bad board. Ranks 1 to 20 are right: P1 gains 10, P19 really leaves, R1 really arrives.
  // Ranks 21 to 30 are an old copy: P21 at its old score, P22 to P25 as they were, P26 to P28
  // from before tA, a September player and a name never seen. N1 to N5 are pushed off.
  const fresh = [P(1, score(1) + 10), ...range(2, 18).map((i) => P(i)), P(20), { name: "R1", score: 2799 }];
  const stale = [P(21), ...range(22, 25).map((i) => P(i)), ...range(26, 28).map((i) => P(i, score(i) - 3)),
    { name: "Sept Player", score: 2705 }, { name: "Ghost", score: 2700 }];
  await ingestBoard(db, OCT, "global", [...ranked(fresh), ...ranked(stale, 21)], 30, bad);

  // The next run puts it right; an hour later N1 really moves.
  const fixedBoard = [...fresh, P(21, score(21) + 5), ...range(22, 25).map((i) => P(i)), ...range(1, 5).map((k) => N(k))];
  await ingestBoard(db, OCT, "global", ranked(fixedBoard), 30, fixed);
  await ingestBoard(db, OCT, "global", ranked(fixedBoard.map((r) => (r.name === "N1" ? { ...r, score: 2746 } : r))), 30, tC);
});

describe("cleanup-bad-boards-2026-10.sql", () => {
  const list = () => {
    const start = cleanup.indexOf("insert into bad_boards values\n") + "insert into bad_boards values\n".length;
    return cleanup.slice(start, cleanup.indexOf(";", start));
  };

  it("lists the same seven bad boards as the preview", () => {
    expect(list().trim().split("\n")).toHaveLength(7);
    expect(preview).toContain(list());
  });

  it("previews exactly what it then does, removes the junk, repairs the rest and keeps what was real", async () => {
    // R1 is the one real arrival above the stale part; P21 the one stale row for a player who
    // was already on the board.
    const expected = { stale_sightings: 6, pushed_off: 5, left_again: 5, returns_above_stale_part: 1, already_on_board_in_stale_part: 1, total_standings_removed: 2, total_players_removed: 1 };
    const [previewed] = await runScript(forTest(preview, list())) as Record<string, unknown>[];
    expect(Object.fromEntries(Object.entries(expected).map(([k]) => [k, Number(previewed[k])]))).toEqual(expected);

    const ghost = await id("Ghost");
    const sept = await id("Sept Player");
    const [p21, p26, n1, n2, r1, p19] = [await id("P21"), await id("P26"), await id("N1"), await id("N2"), await id("R1"), await id("P19")];
    expect(await standing(p26)).toMatchObject({ score: score(26) - 3, updated_at: bad, score_changed_at: bad });
    expect(await standing(n2)).toMatchObject({ score_changed_at: fixed });
    expect(await standing(p21)).toMatchObject({ score_changed_at: fixed });

    const [done] = await runScript(forTest(cleanup, list())) as Record<string, unknown>[];
    expect(Object.fromEntries(Object.entries(expected).map(([k]) => [k, Number(done[k])]))).toEqual(expected);

    // What stays at the bad run: P1's real gain, R1's real arrival, P19's real departure.
    expect(await rowsAt(bad)).toBe(3);
    // What stays at the next run: P21 and N1 to N5 as they really were.
    expect(await rowsAt(fixed)).toBe(6);
    expect((await history(n2)).map((h) => h.taken_at)).toEqual([tB, fixed]);

    // Only seen through the bad board: gone, and Ghost's player row with it.
    expect(ghost).toBeDefined();
    expect(await id("Ghost")).toBeUndefined();
    expect(await standing(sept)).toBeUndefined();
    expect((await db.query<{ last_seen: Date }>(`select last_seen from players where id = $1`, [sept]))[0].last_seen).toEqual(new Date("2026-09-20T00:00:00Z"));

    // Repaired from what remains.
    expect(await standing(p26)).toMatchObject({ rank: 26, score: score(26), on_board: false, updated_at: tA, score_changed_at: tA });
    expect(await standing(n2)).toMatchObject({ on_board: true, score_changed_at: tB });
    expect(await standing(p21)).toMatchObject({ score: score(21) + 5, score_changed_at: tB });

    // Real moves are left alone.
    expect(await standing(n1)).toMatchObject({ score: 2746, score_changed_at: tC });
    expect(await standing(r1)).toMatchObject({ first_seen: bad, score_changed_at: bad, on_board: true });
    expect(await standing(p19)).toMatchObject({ on_board: false });
    expect((await history(p19)).at(-1)).toMatchObject({ taken_at: bad, rank: null });
  });

  it("finds nothing more to do when run again", async () => {
    const before = await db.query(`select * from history order by player_id, taken_at`);
    const [again] = await runScript(forTest(cleanup, list())) as Record<string, unknown>[];
    expect(Number(again.stale_sightings) + Number(again.pushed_off) + Number(again.left_again)).toBe(0);
    expect(Number(again.total_standings_removed) + Number(again.total_players_removed)).toBe(0);
    expect(await db.query(`select * from history order by player_id, taken_at`)).toEqual(before);
  });
});
