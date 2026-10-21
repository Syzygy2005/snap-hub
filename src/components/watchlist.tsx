"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  MAX_WATCHED,
  WATCHLIST_KEY,
  parseWatchlist,
  sameRecord,
  toggleWatched,
  unwatch,
  type PlayerRecord,
  type Watched,
} from "@/lib/leaderboard/watchlist";

// Same-tab writes do not fire `storage`, so they announce themselves.
const CHANGED = "snaphub:watchlist-changed";
const EMPTY: Watched[] = [];
let cache: { raw: string | null; list: Watched[] } = { raw: null, list: EMPTY };

function read(): Watched[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(WATCHLIST_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cache.raw) cache = { raw, list: parseWatchlist(raw) };
  return cache.list;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === WATCHLIST_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** Re-reads storage before writing, so a change made in another tab is kept, not overwritten. */
function update(change: (list: Watched[]) => Watched[]) {
  const next = change(read());
  try {
    window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
  } catch {
    return; // Storage refused (a private window): nothing is saved, and the button says so by not changing.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** The visitor's watchlist. Empty on the server and until the browser has been read. */
export function useWatchlist() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = useCallback((player: PlayerRecord) => update((l) => toggleWatched(l, player)), []);
  const remove = useCallback((id: number) => update((l) => unwatch(l, id)), []);
  return { list, toggle, remove };
}

export function WatchButton({ player }: { player: PlayerRecord }) {
  const { list, toggle } = useWatchlist();
  const saved = list.find((w) => w.id === player.id);
  const watching = !!saved && sameRecord(saved, player);
  const full = !watching && list.filter((w) => w.id !== player.id).length >= MAX_WATCHED;
  return (
    <button
      type="button"
      onClick={() => toggle(player)}
      aria-pressed={watching}
      disabled={full}
      title={
        full
          ? `You are watching ${MAX_WATCHED} players. Stop watching one of them first.`
          : watching
            ? "Stop watching. Your watchlist is kept in this browser only."
            : "Follow them on the leaderboard's Watching tab. Kept in this browser only."
      }
      className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        watching ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink"
      }`}
    >
      {watching ? "Watching" : "Watch"}
    </button>
  );
}
