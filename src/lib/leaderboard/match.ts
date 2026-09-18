import type { BoardEntry } from "./fetch";

export interface KnownStanding {
  playerId: number;
  name: string;
  score: number;
}

/**
 * The API has no player IDs, and names are not unique (e.g. several players called "Ghost").
 * Match each board entry to a player we already track this season: by exact name, and when
 * a name is shared, pair entries and players by closest score so each keeps their own history.
 *
 * Returns playerId per entry (same order as `entries`), or null for a player not seen this season.
 */
export function matchEntries(entries: BoardEntry[], known: KnownStanding[]): (number | null)[] {
  const result: (number | null)[] = new Array(entries.length).fill(null);

  const knownByName = new Map<string, KnownStanding[]>();
  for (const k of known) {
    const list = knownByName.get(k.name);
    if (list) list.push(k);
    else knownByName.set(k.name, [k]);
  }

  const entryIdxByName = new Map<string, number[]>();
  entries.forEach((e, i) => {
    const list = entryIdxByName.get(e.name);
    if (list) list.push(i);
    else entryIdxByName.set(e.name, [i]);
  });

  for (const [name, idxs] of entryIdxByName) {
    const candidates = knownByName.get(name);
    if (!candidates) continue;

    if (idxs.length === 1 && candidates.length === 1) {
      result[idxs[0]] = candidates[0].playerId;
      continue;
    }

    // Greedy one-to-one pairing on smallest score gap.
    const pairs: { i: number; c: KnownStanding; gap: number }[] = [];
    for (const i of idxs) {
      for (const c of candidates) pairs.push({ i, c, gap: Math.abs(entries[i].score - c.score) });
    }
    pairs.sort((a, b) => a.gap - b.gap || entries[a.i].rank - entries[b.i].rank);

    const usedEntries = new Set<number>();
    const usedPlayers = new Set<number>();
    for (const { i, c } of pairs) {
      if (usedEntries.has(i) || usedPlayers.has(c.playerId)) continue;
      result[i] = c.playerId;
      usedEntries.add(i);
      usedPlayers.add(c.playerId);
    }
  }

  return result;
}

export interface Departure {
  playerId: number;
  name: string;
  score: number;
  rank: number;
}

export interface Arrival {
  /** Index into the entries array this tick. */
  index: number;
  name: string;
  score: number;
  rank: number;
}

export interface Rename {
  index: number;
  playerId: number;
  from: string;
  to: string;
}

export interface BoardNames {
  /** Every name on the board this tick. */
  onBoard: Set<string>;
  /** Every name already tracked this season, on the board or not. */
  known: Set<string>;
}

/**
 * Spots a player who renamed rather than left and was replaced.
 *
 * The API has no IDs, so a rename looks like one name vanishing and an unrelated one
 * appearing in the same snapshot, which then reads as a brand new player with no history.
 * The thing a rename cannot change is the score, so a departure and an arrival holding the
 * exact same score are almost certainly one person.
 *
 * A real rename retires the old name from the board and brings a name nobody was using, so
 * both sides are checked against the whole board rather than taken at face value. Without
 * that, a name many players share is a trap: matchEntries pairs those by closest score, and
 * when the count shifts it leaves one of them unclaimed even though the name is still all
 * over the board. That unclaimed row is a pairing artifact, not somebody leaving, and
 * pairing it with a genuinely new arrival invented a rename out of nothing.
 *
 * Deliberately conservative, because a wrong guess welds two real players' histories
 * together: a score only counts when exactly one departure and exactly one arrival carry it.
 * Two players sharing a score in one tick are left alone rather than guessed between. This
 * misses a rename by someone who played between snapshots, or onto a name already in use,
 * which is the price of not inventing merges.
 */
export function detectRenames(departures: Departure[], arrivals: Arrival[], names: BoardNames): Rename[] {
  // Someone whose name is still on the board did not leave, whatever the pairing decided.
  departures = departures.filter((d) => !names.onBoard.has(d.name));
  // A name already tracked this season is not a new identity appearing.
  arrivals = arrivals.filter((a) => !names.known.has(a.name));

  const byScore = <T extends { score: number }>(rows: T[]) => {
    const map = new Map<number, T[]>();
    for (const r of rows) {
      const list = map.get(r.score);
      if (list) list.push(r);
      else map.set(r.score, [r]);
    }
    return map;
  };

  const left = byScore(departures);
  const arrived = byScore(arrivals);

  const renames: Rename[] = [];
  for (const [score, gone] of left) {
    const came = arrived.get(score);
    if (gone.length !== 1 || !came || came.length !== 1) continue;
    if (gone[0].name === came[0].name) continue;
    renames.push({ index: came[0].index, playerId: gone[0].playerId, from: gone[0].name, to: came[0].name });
  }
  return renames;
}
