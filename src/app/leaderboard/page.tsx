import type { Metadata } from "next";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { RelativeTime } from "@/components/relative-time";
import { EmptyState, PageHeader, Panel, Stat, Tabs } from "@/components/ui";
import { REGION_LABELS } from "@/lib/config";
import { boardHref, resolveBoardParams } from "@/lib/leaderboard/params";
import { getBoard } from "@/lib/leaderboard/queries";
import { currentSeason, seasonKey, seasonLabel } from "@/lib/season";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Infinite Leaderboard" };

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const { region, season, seasons, regions } = await resolveBoardParams(await props.searchParams);

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
  const live = season === seasonKey(currentSeason());
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
        <LeaderboardTable rows={rows} latestUpdate={meta.updatedAt} />
      </Panel>
    </>
  );
}
