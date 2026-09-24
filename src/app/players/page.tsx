import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { param } from "@/lib/leaderboard/params";
import { searchPlayers } from "@/lib/leaderboard/queries";
import { seasonLabel } from "@/lib/season";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Player search" };

export default async function PlayersPage(props: PageProps<"/players">) {
  const q = (param(await props.searchParams, "q") ?? "").slice(0, 60);
  const results = await searchPlayers(q);

  return (
    <>
      <PageHeader
        title="Players"
        subtitle="Anyone who has appeared in a top 1000 we recorded. Marvel Snap only publishes the top 1000."
      />
      <form action="/players" className="mb-6 flex max-w-lg gap-2">
        <input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          placeholder="Player name"
          aria-label="Player name"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button className="rounded-lg bg-jade px-4 py-2 font-medium text-forest hover:bg-jade-strong">Search</button>
      </form>

      {q && results.length === 0 && (
        <EmptyState title="No players found">
          Nobody named “{q}” has shown up in a top 1000 since tracking started.
        </EmptyState>
      )}

      {results.length > 0 && (
        <Panel>
          <ul>
            {results.map((r) => (
              <li key={r.id} className="border-t border-line/60 first:border-t-0">
                <Link href={`/players/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                  <span className="min-w-0 flex-1 truncate font-medium">{r.name.trim() || "(blank)"}</span>
                  {r.latestSeason && (
                    <span className="text-xs text-muted">
                      {seasonLabel(r.latestSeason)} · {r.onBoard ? "" : "last "}#{r.latestRank}
                    </span>
                  )}
                  <span className="num w-16 text-right font-semibold text-gold">{r.latestScore?.toLocaleString() ?? "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
