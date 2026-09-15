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
