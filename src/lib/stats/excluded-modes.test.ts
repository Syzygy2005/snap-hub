import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { createTracker, recordGame } from "./tracker";
import { getMetaStats, getPersonalStats } from "./queries";

/**
 * Friendly and battle-mode games are recorded but never counted.
 *
 * `friendly` has been filtered since the start and nothing tested it. `battle_mode` was written
 * on every upload and read by nothing, so a battle game went into win rate and cube rate as
 * though it were ranked. Built from the real fixture, turned into three separate games by
 * changing the game ID and the mode flags, so the only difference between them is the mode.
 */
const raw = readFileSync("src/lib/stats/fixtures/real-game.json", "utf8");
const BOM = String.fromCharCode(0xfeff);

function variant(gameId: string, flags: { IsBattleMode?: boolean; IsBattleFriendMode?: boolean }) {
  const data = JSON.parse(raw.slice(1));
  const result = data.RemoteGame.GameState.ClientResultMessage;
  result.GameId = gameId;
  Object.assign(result, flags);
  return BOM + JSON.stringify(data);
}

beforeEach(async () => {
  const db = await getDb();
  await db.query("delete from tracked_games");
  await db.query("delete from snap_names");
  await db.query("delete from trackers");
});

describe("games that are recorded but not counted", () => {
  it("keeps battle-mode and friendly games out of personal and community stats", async () => {
    const made = await createTracker({ name: "Test PC" });
    if (!made.ok) throw new Error(made.error);
    const tracker = made.tracker;

    for (const [id, flags] of [
      ["ranked-game", {}],
      ["battle-game", { IsBattleMode: true }],
      ["friendly-game", { IsBattleFriendMode: true }],
    ] as const) {
      expect(await recordGame(tracker, variant(id, flags), null)).toMatchObject({ ok: true, duplicate: false });
    }

    // All three are stored: filtering happens on read, so nothing uploaded is thrown away.
    const db = await getDb();
    const stored = await db.query<{ game_id: string; battle_mode: boolean; friendly: boolean }>(
      "select game_id, battle_mode, friendly from tracked_games order by game_id",
    );
    expect(stored).toEqual([
      { game_id: "battle-game", battle_mode: true, friendly: false },
      { game_id: "friendly-game", battle_mode: false, friendly: true },
      { game_id: "ranked-game", battle_mode: false, friendly: false },
    ]);

    const mine = await getPersonalStats({ id: tracker.id, name: tracker.name, trackerIds: [tracker.id] }, "all");
    expect(mine.summary.games).toBe(1);
    expect(mine.recent).toHaveLength(1);

    const everyone = await getMetaStats("all", null);
    expect(everyone.summary.games).toBe(1);
    // The league list is counted by a separate query, so it has to agree on its own.
    expect(everyone.leagues.reduce((n, l) => n + l.games, 0)).toBe(1);
  });

  it("still counts ranked games, which read false for both flags on every real file", async () => {
    // The dangerous direction is the flag reading true on a ranked game and hiding it. Both
    // real files are ranked and both parse with neither flag set.
    const made = await createTracker({ name: "Test PC" });
    if (!made.ok) throw new Error(made.error);
    const retreat = readFileSync("src/lib/stats/fixtures/real-retreat.json", "utf8");
    await recordGame(made.tracker, raw, null);
    await recordGame(made.tracker, retreat, null);
    const mine = await getPersonalStats({ id: made.tracker.id, name: made.tracker.name, trackerIds: [made.tracker.id] }, "all");
    expect(mine.summary.games).toBe(2);
  });
});
