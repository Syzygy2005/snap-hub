import type { Metadata } from "next";
import Link from "next/link";
import { CardStatsTable } from "@/components/card-stats-table";
import { CardStrip, CubeRate, LOW_SAMPLE, pct, ShareBar, signed, SmallSample, WinRate } from "@/components/stats-ui";
import { EmptyState, PageHeader, Panel, Stat, Tabs } from "@/components/ui";
import { encodeDeck } from "@/lib/decks/code";
import { param } from "@/lib/leaderboard/params";
import { getMetaStats, STAT_WINDOWS, type StatWindow } from "@/lib/stats/queries";
import { RelativeTime } from "@/components/relative-time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meta Stats" };

const WINDOW_LABELS: Record<StatWindow, string> = { "7d": "7 days", "30d": "30 days", all: "All time" };

export default async function StatsPage(props: PageProps<"/stats">) {
  const sp = await props.searchParams;
  const w = param(sp, "window");
  const window: StatWindow = w && w in STAT_WINDOWS ? (w as StatWindow) : "30d";
  const league = param(sp, "mode") ?? null;
  const stats = await getMetaStats(window, league);

  const href = (next: { window?: StatWindow; mode?: string | null }) => {
    const q = new URLSearchParams();
    const nw = next.window ?? window;
    const nm = next.mode === undefined ? league : next.mode;
    if (nw !== "30d") q.set("window", nw);
    if (nm) q.set("mode", nm);
    const s = q.toString();
    return s ? `/stats?${s}` : "/stats";
  };

  return (
    <>
      <PageHeader
        title="Meta Stats"
        subtitle={
          <>
            From {stats.summary.games.toLocaleString()} tracked game{stats.summary.games === 1 ? "" : "s"} by{" "}
            {stats.trackers} tracker key{stats.trackers === 1 ? "" : "s"} · {WINDOW_LABELS[window]}
          </>
        }
      >
        <Link
          href="/stats/me"
          className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-accent"
        >
          My stats
        </Link>
        <Link href="/stats/tracker" className="rounded-md bg-jade px-4 py-2 text-sm font-semibold text-forest hover:bg-jade-strong">
          Get the tracker
        </Link>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Tabs
          items={(Object.keys(STAT_WINDOWS) as StatWindow[]).map((k) => ({
            href: href({ window: k }),
            label: WINDOW_LABELS[k],
            active: k === window,
          }))}
        />
        {stats.leagues.length > 1 && (
          <Tabs
            items={[
              { href: href({ mode: null }), label: "All modes", active: !league },
              ...stats.leagues.map((l) => ({ href: href({ mode: l.league }), label: l.league, active: l.league === league })),
            ]}
          />
        )}
      </div>

      <p className="mb-4 text-sm text-muted">
        {stats.latestGameAt ? <>Latest included upload: <RelativeTime iso={stats.latestGameAt} />. </> : "No uploads in this selection. "}
        These are tracker contributions, not all Marvel Snap games.
        {stats.summary.games > 0 && stats.summary.games < LOW_SAMPLE && ` Small sample: fewer than ${LOW_SAMPLE} games. Treat rates as early signals.`}
      </p>
      {stats.summary.games === 0 ? (
        <EmptyState title="No tracked games yet">
          Stats come from players running the Snap Hub tracker on PC.{" "}
          <Link href="/stats/tracker" className="text-accent hover:underline">
            Set it up
          </Link>{" "}
          and your games will be the first.
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Games" value={stats.summary.games.toLocaleString()} hint={`${stats.trackers} contributing tracker key(s)`} />
            <Stat label="Deck archetypes" value={stats.archetypes.length} hint="decks sharing 9+ cards are grouped" />
            <Stat label="Tracked win rate" value={pct(stats.summary.winRate)} hint="near 50% once many players track" />
            <Stat label="Avg cube rate" value={signed(stats.summary.cubeRate)} hint="net cubes per game" />
          </div>

          <Panel title="Decks" className="mb-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                    <th className="w-10 px-4 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Archetype</th>
                    <th className="px-2 py-2 font-medium">Meta share</th>
                    <th className="px-2 py-2 text-right font-medium">Games</th>
                    <th className="px-2 py-2 text-right font-medium">Win rate</th>
                    <th className="px-4 py-2 text-right font-medium">Cube rate</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.archetypes.slice(0, 50).map((a, i) => (
                    <tr key={a.key} className="border-t border-line/60 align-top">
                      <td className="num px-4 py-3 text-muted">{i + 1}</td>
                      <td className="px-2 py-3">
                        <details className="group">
                          <summary className="cursor-pointer list-none">
                            <span className="font-semibold group-open:text-accent">{a.name}</span>
                            <span className="ml-2 text-xs text-faint">
                              {a.lists.length} list{a.lists.length === 1 ? "" : "s"} ▾
                            </span>
                            <CardStrip ids={a.coreCards} info={stats.cardInfo} className="mt-1.5" />
                          </summary>
                          <ul className="mt-3 space-y-2 border-l-2 border-accent/40 pl-3">
                            {a.lists.slice(0, 5).map((l) => (
                              <li key={l.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                <CardStrip ids={l.cards} info={stats.cardInfo} />
                                <span className="num text-muted">
                                  {l.games} game{l.games === 1 ? "" : "s"} · <WinRate value={l.winRate} games={l.games} /> ·{" "}
                                  <CubeRate value={l.cubeRate} games={l.games} />
                                </span>
                                <Link
                                  href={`/decks/builder?code=${encodeURIComponent(encodeDeck(l.cards, a.name))}`}
                                  className="font-semibold text-accent hover:underline"
                                >
                                  Open in builder
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </td>
                      <td className="px-2 py-3">
                        <ShareBar value={a.metaShare} />
                      </td>
                      <td className="num whitespace-nowrap px-2 py-3 text-right">{a.games.toLocaleString()}<SmallSample games={a.games} /></td>
                      <td className="px-2 py-3 text-right">
                        <WinRate value={a.winRate} games={a.games} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CubeRate value={a.cubeRate} games={a.games} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Cards" className="mb-6">
            <CardStatsTable stats={stats.cards} info={stats.cardInfo} />
          </Panel>
        </>
      )}

      <Panel tone="quiet" title="How these numbers work">
        <dl className="grid gap-4 p-4 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-semibold text-ink">Win rate</dt>
            <dd>Wins ÷ (wins + losses). Ties don&apos;t count either way.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Cube rate</dt>
            <dd>Average cubes won or lost per game, ties as 0. This is what actually climbs the ladder.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Meta share</dt>
            <dd>Share of tracked games played with that archetype. Decks sharing at least 9 of 12 cards are one archetype.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Sample size</dt>
            <dd>
              Only games from players running the tracker count. Rows under {LOW_SAMPLE} games are tagged small sample; treat those rates as
              a rough guess. Friendly battles are left out.
            </dd>
          </div>
        </dl>
      </Panel>
    </>
  );
}
