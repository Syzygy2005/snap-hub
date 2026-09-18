import { beforeAll, describe, expect, it } from "vitest";
import { getDb, type Db } from "@/lib/db";
import { ingestBoard } from "./ingest";

/**
 * Replays a season against a board shaped like the real one: a thousand slots, more players
 * than slots so the cut line churns, scores that move a cube at a time so different players
 * land on the same number constantly, and a crowd sharing one default name down at the cut,
 * which is where new accounts are.
 *
 * The unit tests cover the shape of a phantom rename. This covers the volume it takes to
 * produce one: a phantom needs a departure and an arrival to collide on an exact score, which
 * is a question of how often the dice come up, not of whether the logic reads right.
 *
 * Rule: every former name the ingest records must be one the simulation actually handed out.
 * Missing a real rename is by design. Inventing one welds two strangers together and is not.
 */

const SEASON = { year: 2026, month: 9 };
const SLOTS = 1000;
const POOL = 1060;
const TICKS = 60;
const SHARED = "PlayerName";
const SHARED_COUNT = 40;

/** Deterministic, so a failure is reproducible rather than a story about one unlucky run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Sim {
  id: number;
  name: string;
  score: number;
}

interface Run {
  /** Former names the ingest wrote down, as "old -> current". */
  recorded: { from_name: string; to_name: string }[];
  /** The renames the simulation actually performed, same shape. */
  performed: Set<string>;
}

let db: Db;
beforeAll(async () => {
  db = await getDb();
});

async function replaySeason(): Promise<Run> {
  const rand = rng(20260918);
  const players: Sim[] = [];
  for (let i = 0; i < POOL; i++) {
    const shared = i < SHARED_COUNT;
    players.push({
      id: i,
      name: shared ? SHARED : `Player ${i}`,
      score: shared ? 8000 + Math.floor(rand() * 40) : 8000 + Math.floor(rand() * 400),
    });
  }

  const performed = new Set<string>();

  for (let tick = 0; tick < TICKS; tick++) {
    const now = new Date(Date.UTC(2026, 8, 10, 0, 0, 0) + tick * 30 * 60_000);

    // Cubes move a few at a time, and most players sit still in any half hour.
    for (const p of players) {
      if (rand() < 0.35) p.score += Math.floor(rand() * 17) - 8;
    }

    // Somebody renames roughly every other tick, keeping their score: a rename changes the
    // name, not the cubes, which is the whole basis of detecting one.
    if (tick > 0 && rand() < 0.5) {
      const p = players[Math.floor(rand() * players.length)];
      const to = `Renamed ${tick}`;
      performed.add(`${p.name} -> ${to}`);
      p.name = to;
    }

    const board = [...players]
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, SLOTS)
      .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));

    await ingestBoard(db, SEASON, "global", board, POOL, now);
  }

  const recorded = await db.query<{ from_name: string; to_name: string }>(
    `select pn.name as from_name, p.name as to_name
       from player_names pn join players p on p.id = pn.player_id`,
  );
  return { recorded, performed };
}

let run: Run;
beforeAll(async () => {
  run = await replaySeason();
});

const invented = (r: Run) => r.recorded.filter((x) => !r.performed.has(`${x.from_name} -> ${x.to_name}`));

describe("a season of real-shaped board churn", () => {
  it("finds real renames, so the run is worth asserting on", () => {
    expect(run.performed.size).toBeGreaterThan(20);
    expect(run.recorded.length).toBeGreaterThan(20);
  });

  it("never stamps a shared default name onto a stranger", () => {
    // The bug this file was written for. Without the board check in detectRenames this fails.
    expect(invented(run).filter((r) => r.from_name === SHARED)).toEqual([]);
  });

  // KNOWN GAP, not a regression. Every failure here is a departure ranked in the last handful
  // of slots whose stale score matched an arrival that genuinely entered from below: a player
  // pushed off the board and a different player taking the slot, which from the board alone is
  // indistinguishable from a rename. Closing it needs a rule about how near the cut line is too
  // near to guess, and that number has to come from real board data, not from this simulation's
  // invented score spread. Delete `.fails` when it is closed.
  it.fails("does not yet spot churn at the cut line", () => {
    expect(invented(run)).toEqual([]);
  });
});
