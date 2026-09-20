import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getDb, type Db } from "@/lib/db";
import { ingestBoard } from "./ingest";

/**
 * Replays a season against a board shaped like the real one. The scores are not invented:
 * fixtures/board-scores.json is the score column of an actual global Infinite board, so the
 * way players bunch up towards the cut line is the real shape rather than a guess. That
 * matters more than anything else here, because how often two players share a score is what
 * decides whether an exact match is evidence or coincidence.
 *
 * On top of that: more players than slots so the cut line churns, scores moving a cube at a
 * time, a crowd sharing one default name down at the cut where new accounts are, and a real
 * rename every other tick or so.
 *
 * Rule: every former name the ingest records must be one the simulation handed out. Missing a
 * real rename is by design. Inventing one welds two strangers together and is not.
 */

const SEASON = { year: 2026, month: 9 };
const TICKS = 60;
const SHARED = "PlayerName";
const SHARED_COUNT = 40;

const FIXTURE = JSON.parse(readFileSync("src/lib/leaderboard/fixtures/board-scores.json", "utf8"));
const REAL_SCORES: number[] = FIXTURE.scores;
/** Every score change actually seen on that board across one half-hour window. */
const REAL_DELTAS: number[] = FIXTURE.movement.deltas;
const MOVE_CHANCE: number = FIXTURE.movement.changedScore / FIXTURE.movement.playersOnBothBoards;
const SLOTS = REAL_SCORES.length;
/** Enough extra players below the cut that the bottom of the board turns over. */
const POOL = SLOTS + 60;

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
    // Everyone takes a real score off the curve; the overflow sits just under the cut. The
    // default-name crowd is placed at the bottom, which is where new accounts really are.
    const slot = i < SLOTS ? i : SLOTS - 1;
    const shared = i < SHARED_COUNT;
    players.push({
      id: i,
      name: shared ? SHARED : `Player ${i}`,
      score: shared ? REAL_SCORES[SLOTS - 1 - (i % 40)] : REAL_SCORES[slot] - (i < SLOTS ? 0 : (i - SLOTS) % 5),
    });
  }

  const performed = new Set<string>();

  for (let tick = 0; tick < TICKS; tick++) {
    const now = new Date(Date.UTC(2026, 8, 10, 0, 0, 0) + tick * 30 * 60_000);

    // A tick is one of the measured half-hour windows: the same share of players move as
    // really did, and each mover is dealt a change that really happened rather than a made-up
    // one. Most people sit still; the ones who play can swing either way by a lot.
    for (const p of players) {
      if (rand() < MOVE_CHANCE) p.score += REAL_DELTAS[Math.floor(rand() * REAL_DELTAS.length)];
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

  it("does not invent one out of churn at the cut line", () => {
    // This was pinned as a known gap for as long as the dividing line was a guess. It closed
    // once a departure had to clear the cut by more than the worst loss the season has shown,
    // which is the difference between a player the board would have kept and one who lost cubes
    // and fell under it in the same gap. Both halves of that come from measurement: the score
    // curve and the movement in fixtures/board-scores.json, and the drop from the season itself.
    expect(invented(run)).toEqual([]);
  });
});
