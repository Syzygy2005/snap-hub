import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { createTracker, deleteTracker, recordGame } from "./tracker";
import { parseGameState } from "./parse-game";

const text = readFileSync("src/lib/stats/fixtures/real-game.json", "utf8");
const parsed = parseGameState(text);
if (!parsed.ok) throw new Error("Real fixture must parse");
const accountId = parsed.game.accountId!;
const key = async () => {
  const result = await createTracker({ name: "Test PC" });
  if (!result.ok) throw new Error(result.error);
  return result.tracker;
};

beforeEach(async () => {
  const db = await getDb();
  await db.query("delete from tracked_games");
  await db.query("delete from snap_names");
  await db.query("delete from trackers");
});

describe("upload identity and deduplication", () => {
  it("deduplicates the same real game across keys with and without a header", async () => {
    expect(accountId).toBe("1105e9c9-d183-9f67-6073-8e62d3142ca1");
    expect(await recordGame(await key(), text, null)).toMatchObject({ ok: true, duplicate: false });
    const repeated = await recordGame(await key(), text, accountId);
    expect(repeated).toMatchObject({ ok: true, duplicate: true });
    expect(JSON.stringify(repeated)).not.toContain(accountId);
    const db = await getDb();
    expect(await db.query("select id from tracked_games")).toHaveLength(1);
    expect(await db.query("select account_hash from snap_names")).toHaveLength(1);
  });

  it("uses the parser's fallback identity when the header matches nobody", async () => {
    expect(await recordGame(await key(), text, "not-a-player")).toMatchObject({ duplicate: false });
    expect(await recordGame(await key(), text, null)).toMatchObject({ duplicate: true });
  });

  it("falls back to per-key deduplication only when the file has no account IDs", async () => {
    const withoutIds = JSON.stringify(JSON.parse(text.slice(1)), (name, value) => name === "AccountId" ? undefined : value);
    const a = await key();
    const b = await key();
    expect(await recordGame(a, withoutIds, null)).toMatchObject({ duplicate: false });
    expect(await recordGame(a, withoutIds, null)).toMatchObject({ duplicate: true });
    expect(await recordGame(b, withoutIds, null)).toMatchObject({ duplicate: false });
  });
});

describe("deleting a key", () => {
  it("removes the names it reported, not only its games", async () => {
    const tracker = await key();
    await recordGame(tracker, text, accountId);
    const db = await getDb();
    expect(await db.query("select name from snap_names")).toHaveLength(1);
    await deleteTracker(tracker.id);
    expect(await db.query("select id from tracked_games")).toHaveLength(0);
    expect(await db.query("select name from snap_names")).toHaveLength(0);
  });

  it("keeps the record while another key still has games for that account", async () => {
    const pc = await key();
    const laptop = await key();
    await recordGame(pc, text, accountId);
    // A different game from the same account, uploaded by the person's other key.
    const other = text.replaceAll(parsed.game.gameId, "another-game-id");
    expect(await recordGame(laptop, other, accountId)).toMatchObject({ duplicate: false });
    await deleteTracker(pc.id);
    const db = await getDb();
    expect(await db.query("select name from snap_names")).toHaveLength(1);
    await deleteTracker(laptop.id);
    expect(await db.query("select name from snap_names")).toHaveLength(0);
  });
});

describe("a game that cannot be stored", () => {
  it("leaves nothing behind, so deleting the key still removes everything it sent", async () => {
    // The name used to be written first and on its own. A game insert that then failed left the
    // name behind, and deleteTracker finds names only through games, so it could never remove it.
    const db = await getDb();
    const tracker = await key();
    await db.query(`create or replace function refuse_game() returns trigger language plpgsql as $$ begin raise exception 'refused for the test'; end $$`);
    await db.query(`create trigger refuse_game before insert on tracked_games for each row execute function refuse_game()`);
    try {
      await expect(recordGame(tracker, text, accountId)).rejects.toThrow("refused for the test");
    } finally {
      await db.query(`drop trigger refuse_game on tracked_games`);
      await db.query(`drop function refuse_game()`);
    }
    expect(await db.query("select name from snap_names")).toHaveLength(0);
    const [row] = await db.query<{ last_upload_at: Date | null }>("select last_upload_at from trackers where id = $1", [tracker.id]);
    expect(row.last_upload_at).toBeNull();
  });

  it("is refused as unreadable when its cube value cannot be stored, before anything is written", async () => {
    // A 422 is held by the tracker as "needs attention"; the insert failing instead was a 500,
    // which the tracker retries for ever.
    for (const bad of ["1e12", "2.5"]) {
      const result = await recordGame(await key(), text.replaceAll('"FinalCubeValue":4', `"FinalCubeValue":${bad}`), accountId);
      expect(result).toMatchObject({ ok: false, status: 422, reason: "invalid-fields" });
    }
    const db = await getDb();
    expect(await db.query("select id from tracked_games")).toHaveLength(0);
    expect(await db.query("select name from snap_names")).toHaveLength(0);
  });

  it("keeps a game whose turn count cannot be stored, without the turn count", async () => {
    const result = await recordGame(await key(), text.replaceAll('"TurnsTaken":6', '"TurnsTaken":1e12'), accountId);
    expect(result).toMatchObject({ ok: true, duplicate: false });
    const db = await getDb();
    expect(await db.query("select turns, total_turns from tracked_games")).toEqual([{ turns: null, total_turns: 6 }]);
  });
});

describe("the names an account played under", () => {
  it("counts a game once, however many times or from however many keys it arrives", async () => {
    const pc = await key();
    await recordGame(pc, text, accountId);
    // A retry whose acknowledgement was lost, then the same game from the person's other key.
    await recordGame(pc, text, accountId);
    await recordGame(await key(), text, accountId);
    const db = await getDb();
    expect(await db.query("select games from snap_names")).toEqual([{ games: 1 }]);
    await recordGame(pc, text.replaceAll(parsed.game.gameId, "another-game-id"), accountId);
    expect(await db.query("select games from snap_names")).toEqual([{ games: 2 }]);
  });
});
