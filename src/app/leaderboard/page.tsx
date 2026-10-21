import type { Metadata } from "next";
import Link from "next/link";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { RelativeTime } from "@/components/relative-time";
import { EmptyState, PageHeader, Panel, Stat, Tabs } from "@/components/ui";
import { REGION_LABELS } from "@/lib/config";
import { boardHref, param, resolveBoardParams } from "@/lib/leaderboard/params";
import { getBoard, getPlayerName, isSeasonLive, lastBoardCheck } from "@/lib/leaderboard/queries";
import { DataFreshness } from "@/components/data-freshness";
import { seasonLabel } from "@/lib/season";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Infinite Leaderboard" };

/** `?player=<id>` opens the board at that player. Anything that is not a player id is ignored. */
function playerParam(value: string | undefined) {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const sp = await props.searchParams;
  const { region, season, seasons, regions } = await resolveBoardParams(sp);
  const focusId = playerParam(param(sp, "player"));

  if (!season) {
    return (
      <>
        <PageHeader title="Infinite Leaderboard" />
        <EmptyState title="No snapshots yet">
          The first snapshot runs automatically a few seconds after the server starts. Refresh in a moment.
        </EmptyState>
      </>
    );
  }

  const { meta, rows } = await getBoard(season, region, 24);
  const onBoard = focusId !== null && rows.some((r) => r.id === focusId);
  const [live, checkedAt, missingName] = await Promise.all([
    isSeasonLive(season, region),
    lastBoardCheck(season, region),
    focusId !== null && !onBoard ? getPlayerName(focusId) : null,
  ]);
  const cutoff = rows.at(-1);

  return (
    <>
      <PageHeader
        title="Infinite Leaderboard"
        subtitle={
          <>
            {seasonLabel(season)} · {REGION_LABELS[region]}
            {meta.updatedAt && (
              <>
                {" "}
                · updated <RelativeTime iso={meta.updatedAt} />
              </>
            )}
            {!live && <span className="ml-2 rounded bg-surface-3 px-1.5 py-0.5 text-xs text-muted">Final</span>}
          </>
        }
      >
        {regions.length > 1 && (
          <Tabs
            items={regions.map((r) => ({
              href: boardHref("/leaderboard", { season, region: r }),
              label: REGION_LABELS[r],
              active: r === region,
            }))}
          />
        )}
        {seasons.length > 1 && (
          <Tabs
            items={seasons.slice(0, 6).map((s) => ({
              href: boardHref("/leaderboard", { season: s, region }),
              label: seasonLabel(s).replace(/ \d{4}$/, ""),
              active: s === season,
            }))}
          />
        )}
      </PageHeader>

      <DataFreshness checkedAt={checkedAt} archived={!live} />
      {/* Above the tiles, which fill a phone screen on their own. */}
      {missingName !== null && (
        <p role="status" className="mb-4 rounded-lg border border-line px-3 py-2 text-sm text-muted">
          <Link href={`/players/${focusId}`} className="font-medium text-ink hover:text-accent">
            {missingName.trim() || "(blank)"}
          </Link>{" "}
          is not in this top {rows.length.toLocaleString()}. Their profile has every board they were on.
        </p>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="#1 right now" value={rows[0]?.name.trim() ?? "—"} hint={`${rows[0]?.score.toLocaleString() ?? 0} points`} />
        <Stat
          label={`Top ${rows.length.toLocaleString()} cutoff`}
          value={cutoff ? cutoff.score.toLocaleString() : "—"}
          hint="points needed to be listed"
        />
        <Stat
          label="Players in Infinite"
          value={meta.totalPlayers?.toLocaleString() ?? "—"}
          hint="as reported by Marvel Snap"
        />
        <Stat
          label="Tracking since"
          value={meta.trackingSince ? new Date(meta.trackingSince).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—"}
          hint={
            rows.some((r) => r.pastRank !== undefined)
              ? "24h changes shown"
              : "24h changes appear after a day of snapshots"
          }
        />
      </div>

      <Panel>
        {/* Keyed so that opening the board at another player starts from that player's row. */}
        <LeaderboardTable key={onBoard ? focusId : "top"} rows={rows} latestUpdate={meta.updatedAt} focusId={onBoard ? focusId : null} />
      </Panel>
    </>
  );
}
