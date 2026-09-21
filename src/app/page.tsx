import Link from "next/link";
import { CardArt } from "@/components/cards";
import { LeaderboardTable, RankBadge } from "@/components/leaderboard-table";
import { RelativeTime } from "@/components/relative-time";
import { Panel, PlayerName, RankDelta } from "@/components/ui";
import { latestRelease } from "@/lib/changelog";
import { KIND_LABELS, latestNews } from "@/lib/news/queries";
import { SignInNotice } from "@/components/signin-notice";
import { formatReleaseDate } from "@/components/changelog-date";
import { SITE_NAME, SITE_SLOGAN, SITE_TAGLINE } from "@/lib/config";
import { getCards } from "@/lib/cards/queries";
import { listDecks } from "@/lib/decks/queries";
import { getBoard, getMovers, listSeasons } from "@/lib/leaderboard/queries";
import { param } from "@/lib/leaderboard/params";
import { seasonLabel } from "@/lib/season";

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

      {/* The banner carries its own wordmark and feature callouts, which only fit on a wide
          screen. On a phone it cropped mid-word, repeated the logo already in the header, and
          pushed the board two screens down, so it is simply not drawn there. */}
      <section className="relative -mt-6 mb-8 hidden overflow-hidden border-b border-line sm:mt-0 sm:block sm:rounded-xl sm:border">
        <h1 className="sr-only">
          {SITE_NAME}: {SITE_SLOGAN}
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/banner.webp"
          alt=""
          width={1312}
          height={348}
          fetchPriority="high"
          className="h-44 w-full object-cover object-[28%_50%] sm:h-auto sm:object-center"
        />
      </section>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <p className="max-w-2xl text-muted">
          <span className="block font-display text-sm font-bold uppercase tracking-[0.2em] text-accent">{SITE_TAGLINE}</span>
          {/* One line on a phone. The three buttons underneath say the rest, and the board
              below is the actual argument for staying. */}
          <span className="mt-2 block">
            The Infinite leaderboard, saved every 10 minutes.
            <span className="hidden sm:inline">
              {" "}
              A deck builder that exports straight to the game, and win rate and cube rate from real tracked games.
            </span>
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {FEATURES.map((f, i) => (
            <Link
              key={f.href}
              href={f.href}
              className={`group rounded-md border px-4 py-2 transition-colors ${
                i === 0 ? "border-accent bg-accent text-bg hover:bg-accent-strong" : "border-line hover:border-accent"
              }`}
            >
              <span className="block text-xs font-bold uppercase tracking-wider">{f.title}</span>
              <span className={`block text-[11px] ${i === 0 ? "text-bg/70" : "text-muted"}`}>{f.blurb}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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

        <div className="space-y-6">
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

          <Panel title="Latest decks">
            {decks.length ? (
              <ul>
                {decks.map((d) => (
                  <li key={d.id} className="border-t border-line/60 first:border-t-0">
                    <Link href={`/decks/${d.id}`} className="block px-4 py-3 hover:bg-surface-2/60">
                      <div className="truncate font-medium">{d.name}</div>
                      <div className="mt-1.5 grid grid-cols-12 gap-0.5">
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
