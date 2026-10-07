import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { createTracker } from "@/lib/stats/tracker";
import { POST } from "./route";

const game = readFileSync("src/lib/stats/fixtures/real-game.json", "utf8");
beforeEach(async () => {
  vi.stubEnv("TRACKER_INVITE_CODE", "");
  const db = await getDb();
  await db.query("delete from tracked_games");
  await db.query("delete from snap_names");
  await db.query("delete from trackers");
});

async function uploader() {
  const key = await createTracker({ name: "Queued games" });
  if (!key.ok) throw new Error(key.error);
  return (captured?: string) => POST(new Request("http://localhost/api/tracker/games", {
    method: "POST", body: game,
    headers: { authorization: `Bearer ${key.token}`, ...(captured === undefined ? {} : { "x-snaphub-captured-at": captured }) },
  }));
}

it("keeps a queued game's capture time and records actual upload receipt separately", async () => {
  const upload = await uploader();
  const started = Date.now();
  // PowerShell's round-trip timestamp has seven fractional digits.
  const captured = "2026-09-22T07:50:00.1234567Z";
  expect((await upload(captured)).status).toBe(200);
  const db = await getDb();
  const [row] = await db.query<{ played_at: Date; last_upload_at: Date }>(
    "select g.played_at, t.last_upload_at from tracked_games g join trackers t on t.id = g.tracker_id",
  );
  expect(row.played_at.toISOString()).toBe("2026-09-22T07:50:00.123Z");
  expect(row.last_upload_at.getTime()).toBeGreaterThanOrEqual(started);
  expect((await (await upload("2026-09-23T07:50:00.000Z")).json()).duplicate).toBe(true);
  expect((await db.query<{ played_at: Date }>("select played_at from tracked_games"))[0].played_at).toEqual(row.played_at);
});

it("supports older trackers without a capture header and clamps a fast PC clock", async () => {
  const upload = await uploader();
  const started = Date.now();
  expect((await upload()).status).toBe(200);
  const db = await getDb();
  const [legacy] = await db.query<{ played_at: Date }>("select played_at from tracked_games");
  expect(legacy.played_at.getTime()).toBeGreaterThanOrEqual(started);
  await db.query("delete from tracked_games");
  expect((await upload("2099-01-01T00:00:00.000Z")).status).toBe(200);
  const [future] = await db.query<{ played_at: Date }>("select played_at from tracked_games");
  expect(future.played_at.getTime()).toBeGreaterThanOrEqual(started);
  expect(future.played_at.getTime()).toBeLessThanOrEqual(Date.now());
});

it("rejects malformed capture metadata without recording a game", async () => {
  const upload = await uploader();
  for (const value of ["yesterday", "2026-13-01T00:00:00Z", "2026-09-22"]) {
    expect((await upload(value)).status).toBe(400);
  }
  expect(await (await getDb()).query("select id from tracked_games")).toEqual([]);
});
