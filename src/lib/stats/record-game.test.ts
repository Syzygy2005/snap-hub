import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { createTracker, recordGame } from "./tracker";
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
