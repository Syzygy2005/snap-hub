import type { Metadata } from "next";
import { RankBadge } from "@/components/leaderboard-table";
import { EmptyState, PageHeader, Panel, PlayerName, RankDelta, ScoreDelta, Tabs } from "@/components/ui";
import { REGION_LABELS } from "@/lib/config";
import { boardHref, param, resolveBoardParams } from "@/lib/leaderboard/params";
import { getMovers, type BoardRow } from "@/lib/leaderboard/queries";
import { seasonLabel } from "@/lib/season";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Movers" };

const WINDOWS = { "6h": 6, "24h": 24, "7d": 168 } as const;
type WindowKey = keyof typeof WINDOWS;

export default async function MoversPage(props: PageProps<"/leaderboard/movers">) {
  const sp = await props.searchParams;
  const { region, season } = await resolveBoardParams(sp);
  const w = param(sp, "window");
  const windowKey: WindowKey = w && w in WINDOWS ? (w as WindowKey) : "24h";

  if (!season) {
    return (
      <>
        <PageHeader title="Movers" />
        <EmptyState title="No snapshots yet" />
      </>
    );
  }

  const movers = await getMovers(season, region, WINDOWS[windowKey]);

  return (
    <>
      <PageHeader
        title="Movers"
        subtitle={`Biggest rank changes over the last ${windowKey} · ${seasonLabel(season)} · ${REGION_LABELS[region]}`}
      >
        <Tabs
          items={(Object.keys(WINDOWS) as WindowKey[]).map((k) => ({
            href: boardHref("/leaderboard/movers", { season, region, window: k }),
            label: k,
            active: k === windowKey,
          }))}
        />
      </PageHeader>

      {!movers.comparable ? (
        <EmptyState title="Not enough history yet">
          Movers compare today&apos;s board with the board {windowKey} ago. Snapshots started{" "}
          {movers.meta.trackingSince ? new Date(movers.meta.trackingSince).toUTCString() : "recently"}, so check back
          once they cover that window.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <MoverList title="Climbers" rows={movers.climbers} empty="Nobody climbed." />
          <MoverList title="Fallers" rows={movers.fallers} empty="Nobody fell." />
          <MoverList title="Most points gained" rows={movers.scoreGainers} empty="No point changes." showScore />
          <div className="grid gap-4">
            <MoverList title="New on the board" rows={movers.newEntries} empty="No new entries." />
            <Panel title="Dropped off">
              {movers.droppedOut.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">Nobody dropped off.</p>
              ) : (
                <ul>
                  {movers.droppedOut.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 border-t border-line/60 px-4 py-2 text-sm first:border-t-0">
                      <span className="num w-20 text-xs text-muted">was #{r.lastRank}</span>
                      <PlayerName id={r.id} name={r.name} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function MoverList({ title, rows, empty, showScore }: { title: string; rows: BoardRow[]; empty: string; showScore?: boolean }) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{empty}</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-t border-line/60 px-4 py-2 text-sm first:border-t-0">
              <span className="num w-12">
                <RankBadge rank={r.rank} />
              </span>
              <span className="min-w-0 flex-1">
                <PlayerName id={r.id} name={r.name} shared={r.sharedName} />
              </span>
              <span className="w-16 text-right text-xs">
                {showScore ? (
                  <ScoreDelta past={r.pastScore} now={r.score} />
                ) : (
                  <RankDelta past={r.pastRank} now={r.rank} isNew={r.isNew} />
                )}
              </span>
              <span className="num w-16 text-right font-semibold text-gold">{r.score.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
