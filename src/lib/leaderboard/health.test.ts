import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, type Db } from "@/lib/db";
import type { Region } from "@/lib/config";
import { parseSeason } from "@/lib/season";
import { ingestBoard, type IngestSummary } from "./ingest";
import { getSnapshotHealth, snapshotRunSucceeded, type SnapshotHealth } from "./health";

let db: Db;
const now = new Date("2026-10-07T12:00:00Z");

beforeEach(async () => {
  vi.stubEnv("LEADERBOARD_REGIONS", "global");
  db = await getDb();
  await db.query("truncate table history, standings, player_names, player_claims, players, snapshots restart identity");
  await db.query("delete from meta");
});
afterEach(() => vi.unstubAllEnvs());

async function checkedBoard(season: string, at: Date, region: Region = "global") {
  await ingestBoard(db, parseSeason(season)!, region, [{ rank: 1, name: "Alpha", score: 9000 }], 1, at);
  await db.query("insert into meta(key,value,updated_at) values ($1,'{}'::jsonb,$2)", [`board_checked:${season}:${region}`, at]);
}

it("reports missing data and never advances a successful check itself", async () => {
  const health = await getSnapshotHealth(now);
  expect(health).toEqual({ ok: false, maxAgeMinutes: 30, boards: [{ season: "2026-10", region: "global", checkedAt: null, status: "missing" }] });
  expect(await db.query("select * from meta")).toEqual([]);
});

it("uses successful source checks, not an overall cron timestamp, with a 30-minute threshold", async () => {
  const checked = new Date(now.getTime() - 30 * 60_000);
  await checkedBoard("2026-10", checked);
  await db.query("insert into meta(key,value,updated_at) values ('last_snapshot','{}'::jsonb,$1)", [now]);
  expect((await getSnapshotHealth(now)).ok).toBe(true);
  const stale = await getSnapshotHealth(new Date(now.getTime() + 1));
  expect(stale.ok).toBe(false);
  expect(stale.boards[0]).toMatchObject({ status: "stale", checkedAt: checked.toISOString() });
});

it("monitors the previous board during rollover, then requires the published current board", async () => {
  await checkedBoard("2026-09", now);
  expect((await getSnapshotHealth(now)).boards[0]).toMatchObject({ season: "2026-09", status: "fresh" });
  await checkedBoard("2026-10", new Date(now.getTime() - 31 * 60_000));
  expect((await getSnapshotHealth(now)).boards[0]).toMatchObject({ season: "2026-10", status: "stale" });
});

it("does not substitute closed or older archives for a missing active board", async () => {
  await checkedBoard("2026-08", now);
  await checkedBoard("2026-09", now);
  await db.query("insert into meta(key,value) values ('season_closed:2026-09:global','{}'::jsonb)");
  expect((await getSnapshotHealth(now)).boards[0]).toMatchObject({ season: "2026-10", status: "missing" });
});

it("fails when any configured region has no recent successful check", async () => {
  vi.stubEnv("LEADERBOARD_REGIONS", "global,america");
  await checkedBoard("2026-10", now);
  const health = await getSnapshotHealth(now);
  expect(health.ok).toBe(false);
  expect(health.boards.map((board) => board.status)).toEqual(["fresh", "missing"]);
});

it("allows an empty new month only when the active previous board refreshed in this run", () => {
  const health: SnapshotHealth = { ok: true, maxAgeMinutes: 30, boards: [{ season: "2026-09", region: "global", checkedAt: now.toISOString(), status: "fresh" }] };
  const summaries: IngestSummary[] = [
    { season: "2026-10", region: "global", status: "unavailable", detail: "Empty board" },
    { season: "2026-09", region: "global", status: "unchanged" },
  ];
  expect(snapshotRunSucceeded(summaries, health)).toBe(true);
  expect(snapshotRunSucceeded([{ ...summaries[0], status: "error" }, summaries[1]], health)).toBe(false);
  // A successful check ten minutes earlier cannot turn a failed current run green.
  expect(snapshotRunSucceeded([summaries[0], { ...summaries[1], status: "unavailable" }], health)).toBe(false);
  expect(snapshotRunSucceeded(summaries, { ...health, ok: false })).toBe(false);
});
