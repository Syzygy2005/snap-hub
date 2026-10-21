import { getDb } from "@/lib/db";
import { cleanEnv } from "@/lib/env";
import { REGION_LABELS } from "@/lib/config";
import { seasonLabel } from "@/lib/season";
import type { SnapshotHealth } from "./health";
import type { IngestSummary } from "./ingest";

/**
 * Tells a Discord channel when the leaderboard stops refreshing, and when it starts again.
 *
 * It runs at the end of every snapshot, which already knows whether the board is fresh, so it
 * needs no schedule of its own and asks the official board for nothing. The freshness monitor on
 * GitHub Actions only got a run in every few hours (12 in about 50 hours, 19 to 21 October 2026).
 * What this cannot see is Vercel Cron itself stopping, since it runs inside it; that is what the
 * GitHub monitor is still there for.
 *
 * It posts on a change only, never on every stale run: the `snapshot_alert` row in `meta` holds
 * the last state told, and the write that flips it decides which run posts.
 */

const STATE_KEY = "snapshot_alert";
/** Discord's limit on a message's content. */
const DISCORD_LIMIT = 2000;
/** How long a slow Discord may hold up a snapshot run. Chosen, not measured; the route allows 60s. */
const POST_TIMEOUT_MS = 5000;

/** The webhook to post to. Only an https Discord webhook address is used; anything else is ignored. */
export function alertWebhookUrl(): string | null {
  const url = cleanEnv("SNAPSHOT_ALERT_DISCORD_URL");
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const discord = /^((ptb|canary)\.)?discord(app)?\.com$/.test(parsed.hostname);
    return parsed.protocol === "https:" && discord && parsed.pathname.startsWith("/api/webhooks/") ? parsed.toString() : null;
  } catch {
    return null;
  }
}

const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
const board = (season: string, region: keyof typeof REGION_LABELS) => `${seasonLabel(season)} ${REGION_LABELS[region]}`;

export function alertMessage(health: SnapshotHealth, summaries: IngestSummary[], now: Date): string {
  if (health.ok) {
    const lines = health.boards.map((b) => `${board(b.season, b.region)}: refreshed ${b.checkedAt ? utc(b.checkedAt) : "just now"}.`);
    return ["Snap Hub: the leaderboard is refreshing again.", ...lines].join("\n");
  }
  const stale = health.boards
    .filter((b) => b.status !== "fresh")
    .map((b) =>
      b.checkedAt
        ? `${board(b.season, b.region)}: last refreshed ${utc(b.checkedAt)}, ${Math.round((now.getTime() - Date.parse(b.checkedAt)) / 60_000)} minutes ago.`
        : `${board(b.season, b.region)}: never refreshed.`,
    );
  const run = summaries.map((s) => `${board(s.season, s.region)}: ${s.status}${s.detail ? `. ${s.detail}` : ""}`);
  return [
    `Snap Hub: the leaderboard has not refreshed in over ${health.maxAgeMinutes} minutes.`,
    ...stale,
    "",
    "This run:",
    ...run,
  ].join("\n");
}

export type AlertResult = "off" | "unchanged" | "sent" | "failed";

export async function notifyHealthChange(health: SnapshotHealth, summaries: IngestSummary[], now = new Date()): Promise<AlertResult> {
  const url = alertWebhookUrl();
  if (!url) return "off";
  const stale = !health.ok;
  const db = await getDb();
  // Decided in the write: of two runs that see the same change, only the one that flips the row
  // posts. `prev` reads the row as it was before this statement.
  const [row] = await db.query<{ before: string | null; changed: boolean }>(
    `with prev as (select value->>'stale' as stale from meta where key = $1),
          flipped as (
            insert into meta (key, value, updated_at) values ($1, $2::text::jsonb, $3)
            on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at
             where meta.value->>'stale' is distinct from excluded.value->>'stale'
            returning 1
          )
     select (select stale from prev) as before, exists (select 1 from flipped) as changed`,
    [STATE_KEY, JSON.stringify({ stale }), now],
  );
  if (!row?.changed) return "unchanged";
  // The first record of a healthy board is where alerts start from, not a recovery.
  if (!stale && row.before === null) return "unchanged";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Never ping anyone: run details can carry text from the source.
      body: JSON.stringify({ content: alertMessage(health, summaries, now).slice(0, DISCORD_LIMIT), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    });
    if (res.ok) return "sent";
    console.error("[snapshot alert] Discord answered", res.status);
  } catch (err) {
    console.error("[snapshot alert] could not reach Discord", String(err));
  }
  // Not delivered: put the state back, so the next run tries again instead of staying quiet.
  if (row.before === null) {
    await db.query(`delete from meta where key = $1 and value->>'stale' = $2`, [STATE_KEY, String(stale)]);
  } else {
    await db.query(`update meta set value = $2::text::jsonb where key = $1 and value->>'stale' = $3`, [
      STATE_KEY,
      JSON.stringify({ stale: !stale }),
      String(stale),
    ]);
  }
  return "failed";
}
