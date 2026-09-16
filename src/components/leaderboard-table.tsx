"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { BoardRow } from "@/lib/leaderboard/queries";
import { PlayerName, RankDelta, ScoreDelta } from "./ui";
import { formatLastMoved, useNow } from "./relative-time";

const PAGE = 100;

type Filter = "all" | "active" | "climbing";

export function LeaderboardTable({
  rows,
  compact = false,
  latestUpdate = null,
}: {
  rows: BoardRow[];
  compact?: boolean;
  /** taken_at of the newest snapshot. A score that changed then moved in the last push. */
  latestUpdate?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const deferredQuery = useDeferredValue(query);
  const now = useNow();

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && String(r.rank) !== q) return false;
      if (filter === "active") return typeof r.pastScore === "number" ? r.pastScore !== r.score : r.isNew;
      if (filter === "climbing") return typeof r.pastRank === "number" && r.pastRank > r.rank;
      return true;
    });
  }, [rows, deferredQuery, filter]);

  const visible = compact ? filtered : filtered.slice(0, limit);

  return (
    <div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Filter by name or rank…"
            aria-label="Filter leaderboard"
            className="min-w-0 flex-1 basis-full rounded-lg border border-line bg-bg px-3 py-1.5 text-base placeholder:text-faint focus:border-accent focus:outline-none sm:max-w-xs sm:basis-auto sm:text-sm"
          />
          <div className="flex gap-1 text-sm" role="group" aria-label="Show">
            {(
              [
                ["all", "All"],
                ["active", "Played 24h"],
                ["climbing", "Climbing"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value);
                  setLimit(PAGE);
                }}
                aria-pressed={filter === value}
                className={`rounded-md border px-2.5 py-1 font-medium transition-colors ${
                  filter === value
                    ? "border-accent bg-accent/15 text-ink"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="num ml-auto text-xs text-faint">
            {filtered.length.toLocaleString()} player{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
              <th className="w-16 px-4 py-2 font-medium">Rank</th>
              <th className="w-16 px-2 py-2 font-medium">24h</th>
              <th className="px-2 py-2 font-medium">Player</th>
              <th className="py-2 pl-2 pr-4 text-right font-medium sm:pr-2">Points</th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">24h pts</th>
              {!compact && <th className="hidden px-2 py-2 text-right font-medium md:table-cell">Best</th>}
              {!compact && <th className="hidden px-4 py-2 text-right font-medium lg:table-cell">Last played</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-t border-line/60 hover:bg-surface-2/60">
                <td className="num px-4 py-2">
                  <RankBadge rank={r.rank} />
                </td>
                <td className="px-2 py-2 text-xs">
                  <RankDelta past={r.pastRank} now={r.rank} isNew={r.isNew} />
                </td>
                <td className="max-w-[14rem] px-2 py-2 sm:max-w-none">
                  <PlayerName id={r.id} name={r.name} shared={r.sharedName} />
                </td>
                <td className="num py-2 pl-2 pr-4 text-right font-semibold text-gold sm:pr-2">{r.score.toLocaleString()}</td>
                <td className="hidden px-2 py-2 text-right text-xs sm:table-cell">
                  <ScoreDelta past={r.pastScore} now={r.score} />
                </td>
                {!compact && (
                  <td className="num hidden px-2 py-2 text-right text-muted md:table-cell">#{r.bestRank}</td>
                )}
                {!compact && (
                  <td className="hidden px-4 py-2 text-right text-xs text-muted lg:table-cell">
                    {latestUpdate && r.scoreChangedAt === latestUpdate ? (
                      <span
                        title="Score moved in the most recent update"
                        className="inline-flex items-center gap-1 font-semibold text-up"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden />
                        Live
                      </span>
                    ) : now === null ? (
                      ""
                    ) : (
                      formatLastMoved(r.scoreChangedAt, now)
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!compact && filtered.length > limit && (
        <div className="border-t border-line p-3 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE * 2)}
            className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-ink"
          >
            Show more ({(filtered.length - limit).toLocaleString()} left)
          </button>
        </div>
      )}
      {!compact && filtered.length === 0 && <p className="p-8 text-center text-sm text-muted">No players match.</p>}
    </div>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  const top =
    rank === 1
      ? "bg-gold text-bg"
      : rank <= 3
        ? "bg-gold/25 text-gold"
        : rank <= 10
          ? "bg-gem-purple/20 text-gem-purple"
          : "text-muted";
  return (
    <span className={`inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 text-xs font-bold ${top}`}>
      {rank}
    </span>
  );
}
