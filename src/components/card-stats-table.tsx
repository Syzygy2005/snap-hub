"use client";
import Link from "next/link";

import { useMemo, useState } from "react";
import type { CardStat } from "@/lib/stats/aggregate";
import type { Card } from "@/lib/cards/types";
import { CardArt } from "./cards";
import { CubeRate, LOW_SAMPLE, pct, SmallSample, WinRate } from "./stats-ui";

type SortKey = "games" | "winRate" | "drawnWinRate" | "playedWinRate" | "cubeRate";

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "games", label: "Games", title: "Games with this card in the deck, and share of all tracked games" },
  { key: "winRate", label: "Deck WR", title: "Win rate when the card is in the deck" },
  { key: "drawnWinRate", label: "Drawn WR", title: "Win rate in games where the card was drawn" },
  { key: "playedWinRate", label: "Played WR", title: "Win rate in games where the card was played" },
  { key: "cubeRate", label: "Cube rate", title: "Average net cubes per game with the card in the deck" },
];

export function CardStatsTable({
  stats,
  info,
}: {
  stats: CardStat[];
  info: Record<string, Pick<Card, "name" | "art" | "cost">>;
}) {
  const [sort, setSort] = useState<SortKey>("games");
  const [query, setQuery] = useState("");
  const [hideLow, setHideLow] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stats
      .filter((s) => (!q || (info[s.defId]?.name ?? s.defId).toLowerCase().includes(q)) && (!hideLow || s.games >= LOW_SAMPLE))
      .sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity) || b.games - a.games);
  }, [stats, info, query, sort, hideLow]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a card…"
          aria-label="Find a card"
          className="min-w-0 flex-1 basis-full rounded-md border border-line bg-bg px-3 py-1.5 text-base placeholder:text-faint focus:border-accent focus:outline-none sm:max-w-xs sm:basis-auto sm:text-sm"
        />
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={hideLow} onChange={(e) => setHideLow(e.target.checked)} className="accent-accent" />
          Hide cards with under {LOW_SAMPLE} games
        </label>
        <span className="num ml-auto text-xs text-faint">{rows.length} cards</span>
      </div>
      <div className="overflow-x-auto">
        <table className="card-stats-table w-full min-w-[640px] text-sm" data-sort={sort}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
              <th className="px-4 py-2 font-medium">Card</th>
              {COLUMNS.map((c) => (
                <th key={c.key} aria-sort={sort === c.key ? "descending" : undefined} className="px-2 py-2 text-right font-medium" title={c.title}>
                  <button
                    type="button"
                    onClick={() => setSort(c.key)}
                    aria-pressed={sort === c.key}
                    className={`uppercase tracking-wider ${sort === c.key ? "text-accent" : "hover:text-ink"}`}
                  >
                    {c.label}
                    {sort === c.key ? " ↓" : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const card = info[s.defId];
              return (
                <tr key={s.defId} className="border-t border-line/60">
                  <td className="px-4 py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="w-9 shrink-0">{card && <CardArt card={card} />}</span>
                      <span className="truncate font-medium">{card ? <Link className="hover:text-accent underline-offset-2 hover:underline" href={`/wiki/cards/${encodeURIComponent(s.defId)}`}>{card.name}</Link> : s.defId}</span>
                    </span>
                  </td>
                  <td className="num whitespace-nowrap px-2 py-1.5 text-right">
                    {s.games.toLocaleString()} <span className="text-xs text-faint">({pct(s.playRate, 0)})</span><SmallSample games={s.games} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <WinRate value={s.winRate} games={s.games} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <WinRate value={s.drawnWinRate} games={s.drawnGames} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <WinRate value={s.playedWinRate} games={s.playedGames} />
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <CubeRate value={s.cubeRate} games={s.games} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
