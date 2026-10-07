import { trackedRegions, type Region } from "@/lib/config";
import { getDb } from "@/lib/db";
import { currentSeason, previousSeason, seasonKey } from "@/lib/season";
import type { IngestSummary } from "./ingest";
import { lastBoardCheck } from "./queries";

export const MAX_BOARD_AGE_MINUTES = 30;

export interface SnapshotHealth {
  ok: boolean;
  maxAgeMinutes: number;
  boards: {
    season: string;
    region: Region;
    checkedAt: string | null;
    status: "fresh" | "stale" | "missing";
  }[];
}

/** Read only: a monitor must not refresh the data it is checking. */
export async function getSnapshotHealth(now = new Date()): Promise<SnapshotHealth> {
  const db = await getDb();
  const current = currentSeason(now);
  const cur = seasonKey(current);
  const prev = seasonKey(previousSeason(current));
  const boards = await Promise.all(trackedRegions().map(async (region) => {
    // The previous board remains active until the new month publishes a board. A closed
    // archive, or an even older season, must never make an idle snapshot job look healthy.
    const [active] = await db.query<{ season: string }>(
      `select distinct season from standings
        where region = $1 and season = any($2::text[])
          and (season = $3 or not exists (select 1 from meta where key = $4))
        order by season desc limit 1`,
      [region, [cur, prev], cur, `season_closed:${prev}:${region}`],
    );
    const season = active?.season ?? cur;
    const checkedAt = await lastBoardCheck(season, region);
    const status = !checkedAt ? "missing" as const
      : now.getTime() - Date.parse(checkedAt) > MAX_BOARD_AGE_MINUTES * 60_000 ? "stale" as const
      : "fresh" as const;
    return { season, region, checkedAt, status };
  }));
  return { ok: boards.every((board) => board.status === "fresh"), maxAgeMinutes: MAX_BOARD_AGE_MINUTES, boards };
}

export function snapshotRunSucceeded(summaries: IngestSummary[], health: SnapshotHealth): boolean {
  // A recent earlier success must not mask this run's failure. Empty/unpublished months
  // are allowed only when the active board actually refreshed in this run.
  return health.ok && !summaries.some((summary) => summary.status === "error") &&
    health.boards.every((board) => summaries.some((summary) =>
      summary.season === board.season && summary.region === board.region &&
      (summary.status === "updated" || summary.status === "unchanged"),
    ));
}
