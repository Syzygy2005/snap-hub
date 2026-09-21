import Link from "next/link";
import { BrandGlyph } from "@/components/brand";
import { InteractiveArt } from "@/components/interactive-art";
import { CardArt } from "@/components/cards";
import { LeaderboardTable, RankBadge } from "@/components/leaderboard-table";
import { RelativeTime } from "@/components/relative-time";
import { Panel, PlayerName, RankDelta } from "@/components/ui";
import { latestRelease } from "@/lib/changelog";
import { KIND_LABELS, latestNews } from "@/lib/news/queries";
import { SignInNotice } from "@/components/signin-notice";
import { formatReleaseDate } from "@/components/changelog-date";

import { getCards } from "@/lib/cards/queries";
import { listDecks } from "@/lib/decks/queries";
import { getBoard, getMovers, listSeasons, lastBoardCheck } from "@/lib/leaderboard/queries";
import { DataFreshness } from "@/components/data-freshness";
import { param } from "@/lib/leaderboard/params";
import { seasonLabel, seasonKey, currentSeason } from "@/lib/season";

export const dynamic = "force-dynamic";

const FEATURES = [
  { href: "/decks/builder", title: "Deck Builder", blurb: "Create. Optimize. Climb." },
  { href: "/leaderboard", title: "Leaderboard", blurb: "See where you stand." },
  { href: "/stats", title: "Stats Tracker", blurb: "Track your progress." },
];

export default async function Home(props: PageProps<"/">) {
  const signin = param(await props.searchParams, "signin");
  const latest = latestRelease();
  const news = await latestNews();
  const [season] = await listSeasons("global");
  const checkedAt = season ? await lastBoardCheck(season, "global") : null;
  const [board, movers, decks, cards] = await Promise.all([
    season ? getBoard(season, "global", 24) : null,
    season ? getMovers(season, "global", 24, 6) : null,
    listDecks({ limit: 3 }),
    getCards({ deckableOnly: true }),
  ]);
  const byId = new Map(cards.map((c) => [c.defId, c]));

  return (
    <>
      <SignInNotice reason={signin} />

      <section className="brand-hero mb-5 grid overflow-hidden rounded-xl border border-line md:grid-cols-[1.4fr_1fr]">
        <div className="p-5 sm:p-8 lg:p-10">
          <p className="brand-eyebrow text-bg/75">Snap Hub <span className="mx-2 text-accent-deep">/</span> Build. Track. Compete.</p>
          <h1 className="mt-4 max-w-xl font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Build your next<br className="hidden sm:block" /> winning deck.</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-bg/80 sm:text-base">Explore the cards. Learn from your games. Find your place on the leaderboard.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/decks/builder" className="brand-action rounded-lg bg-bg px-5 py-3 text-sm font-bold text-ink hover:bg-surface">Build a deck <span className="ml-3 text-accent" aria-hidden>↗</span></Link>
            <Link href="/wiki" className="brand-action rounded-lg border border-bg/30 px-5 py-3 text-sm font-semibold text-bg hover:bg-bg/5">Explore the wiki</Link>
          </div>
        </div>
        <div className="brand-hero-art relative hidden items-center justify-center overflow-hidden p-8 md:flex" aria-hidden="true">
          <InteractiveArt className="relative z-10 w-56"><BrandGlyph size={224} /></InteractiveArt>
          <p className="absolute bottom-5 text-[10px] font-semibold uppercase tracking-[.24em] text-muted">Play / Collect / Improve / Belong</p>
        </div>
      </section>
      <nav aria-label="Explore Snap Hub" className="mb-8 grid grid-cols-3 gap-2 sm:gap-4">
        {FEATURES.map((f,i) => <Link key={f.href} href={f.href} className="brand-tile rounded-lg border border-line bg-surface/60 p-3 sm:p-4"><span className="mb-2 hidden text-[10px] font-medium tracking-widest text-accent sm:block">0{i+1} /</span><span className="block font-display text-xs font-bold sm:text-base">{f.title}</span><span className="mt-1 hidden text-xs text-muted sm:block">{f.blurb}</span></Link>)}
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
        <Panel
          title={season ? `Top 10 · ${seasonLabel(season)}` : "Top 10"}
          action={
            board?.meta.updatedAt ? (
              <span className="text-xs text-muted">
                Updated <RelativeTime iso={board.meta.updatedAt} />
              </span>
            ) : null
          }
        >
          <DataFreshness checkedAt={checkedAt} archived={!!season && season !== seasonKey(currentSeason())} />
          {board ? (
            <>
              <LeaderboardTable rows={board.rows.slice(0, 10)} compact latestUpdate={board.meta.updatedAt} />
              <div className="border-t border-line p-3 text-center">
                <Link href="/leaderboard" className="text-sm font-semibold text-accent hover:underline">
                  Full top {board.rows.length.toLocaleString()} →
                </Link>
              </div>
            </>
          ) : (
            <p className="p-8 text-center text-sm text-muted">The first snapshot is on its way. Refresh in a moment.</p>
          )}
        </Panel>

          <Panel title="Latest decks" action={<Link href="/decks" className="text-xs font-semibold text-accent hover:underline">All decks</Link>}>
            {decks.length ? (
              <ul>
                {decks.map((d) => (
                  <li key={d.id} className="border-t border-line/60 first:border-t-0">
                    <Link href={`/decks/${d.id}`} className="block px-4 py-3 hover:bg-surface-2/60">
                      <div className="truncate font-medium">{d.name}</div>
                      <div className="mt-1.5 grid grid-cols-6 gap-1 sm:grid-cols-12">
                        {d.cards.map((id) => {
                          const c = byId.get(id);
                          return c ? <CardArt key={id} card={c} /> : null;
                        })}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted">
                No decks yet.{" "}
                <Link href="/decks/builder" className="text-accent hover:underline">
                  Share the first one
                </Link>
                .
              </p>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel
            title="Climbing today"
            action={
              <Link href="/leaderboard/movers" className="text-xs font-semibold text-accent hover:underline">
                All movers
              </Link>
            }
          >
            {movers?.comparable && movers.climbers.length > 0 ? (
              <ul>
                {movers.climbers.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 border-t border-line/60 px-4 py-2 text-sm first:border-t-0">
                    <RankBadge rank={r.rank} />
                    <span className="min-w-0 flex-1">
                      <PlayerName id={r.id} name={r.name} renamedFrom={r.renamedFrom} />
                    </span>
                    <span className="text-xs">
                      <RankDelta past={r.pastRank} now={r.rank} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted">
                Climbers show up once there&apos;s a full day of snapshots to compare against.
              </p>
            )}
          </Panel>



          {news && (
            <Panel
              title="Game news"
              action={
                <Link href="/news" className="text-xs font-medium text-accent hover:underline">
                  All news
                </Link>
              }
            >
              <div className="px-4 py-3">
                <p className="text-xs text-faint">
                  {KIND_LABELS[news.kind]} &middot;{" "}
                  {new Date(news.publishedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </p>
                <Link href="/news" className="mt-1 block font-medium hover:text-accent">
                  {news.title}
                </Link>
              </div>
            </Panel>
          )}

          {latest && (
            <Panel
              title="What's new"
              action={
                <Link href="/changelog" className="text-xs font-medium text-accent hover:underline">
                  All updates
                </Link>
              }
            >
              <p className="px-4 pt-3 text-xs text-faint">{formatReleaseDate(latest.date)}</p>
              <ul className="list-disc space-y-1 px-4 pb-4 pl-9 pt-2 text-sm text-muted">
                {latest.changes.slice(0, 3).map((c) => (
                  <li key={c.title}>{c.title}</li>
                ))}
              </ul>
            </Panel>
          )}

          <Link
            href="/stats/tracker"
            className="group relative block overflow-hidden rounded-xl border border-line bg-surface px-4 py-4 transition-colors hover:border-accent"
          >
            <div className="brand-slashes absolute inset-y-0 right-0 w-16 opacity-25" aria-hidden />
            <div className="relative">
              <div className="font-display text-sm font-bold uppercase tracking-wider text-accent">Stats Tracker</div>
              <p className="mt-1 text-sm text-muted">
                Play on PC? Run the tracker while you play to get your win rate, cube rate and match history, and add
                your games to the meta stats.
              </p>
              <span className="mt-2 inline-block text-xs font-semibold text-ink group-hover:text-accent">Set it up →</span>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
