/**
 * Players a visitor follows on the leaderboard, kept in their browser only.
 *
 * A player id alone does not say who somebody is: `reset-leaderboard.sql` restarts the ids, so
 * after a wipe a saved id names a stranger, and a merge deletes the absorbed id. The name alone
 * does not either, because a detected rename changes it while the record stays the same. What
 * does is the record's first sighting: a merge only ever moves the kept record's `first_seen`
 * earlier (`least(...)` in `merge.ts`), a rename leaves it alone, and a record created after the
 * watch was saved cannot be the player who was saved. Both dates come from the server.
 *
 * No imports, so the profile's button and the board can share it without pulling in the
 * database client.
 */

export const WATCHLIST_KEY = "snaphub:watchlist";
/** A bound on what one browser sends to /api/players, not a measured figure. */
export const MAX_WATCHED = 50;

export interface Watched {
  id: number;
  /** The name when it was saved, shown if the record has gone. */
  name: string;
  /** The record's first sighting, as the server gave it. */
  firstSeen: string;
}

export interface PlayerRecord {
  id: number;
  name: string;
  firstSeen: string;
}

function isWatched(value: unknown): value is Watched {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Number.isSafeInteger(v.id) && (v.id as number) > 0 && typeof v.name === "string" &&
    typeof v.firstSeen === "string" && !Number.isNaN(Date.parse(v.firstSeen));
}

/** Whatever is stored, read as a list: junk and repeats are dropped rather than trusted. */
export function parseWatchlist(raw: string | null): Watched[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const seen = new Set<number>();
  const list: Watched[] = [];
  for (const item of data) {
    if (!isWatched(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    list.push({ id: item.id, name: item.name, firstSeen: item.firstSeen });
    if (list.length === MAX_WATCHED) break;
  }
  return list;
}

/** Whether the record now behind a saved id is still the player who was saved. */
export function sameRecord(saved: Watched, current: PlayerRecord) {
  return saved.id === current.id && Date.parse(current.firstSeen) <= Date.parse(saved.firstSeen);
}

/**
 * Watching a player who is already watched stops it. A saved entry for the same id that is a
 * different record (the board was started over) is replaced, not kept beside the new one.
 */
export function toggleWatched(list: Watched[], player: PlayerRecord): Watched[] {
  const current = list.find((w) => w.id === player.id);
  if (current && sameRecord(current, player)) return list.filter((w) => w.id !== player.id);
  const rest = list.filter((w) => w.id !== player.id);
  if (rest.length >= MAX_WATCHED) return list;
  return [...rest, { id: player.id, name: player.name, firstSeen: player.firstSeen }];
}

export function unwatch(list: Watched[], id: number): Watched[] {
  return list.filter((w) => w.id !== id);
}
