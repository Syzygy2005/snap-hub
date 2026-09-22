// Stat definitions (shown on the Stats page too):
//   Win rate   = wins / (wins + losses). Ties are left out.
//   Cube rate  = average net cubes per game (wins +, losses -, ties 0). The number that moves your rank.
//   Meta share = share of tracked games played with that deck archetype.
// Card stats follow Untapped.gg's idea of "in deck", "drawn" and "played" win rates.

export interface GameForStats {
  deckCards: string[];
  result: "win" | "loss" | "tie";
  cubes: number;
  cardsDrawn: string[];
  cardsPlayed: string[];
}

export interface Summary {
  games: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number | null;
  cubeRate: number | null;
  netCubes: number;
}

export function summarize(games: Pick<GameForStats, "result" | "cubes">[]): Summary {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let netCubes = 0;
  for (const g of games) {
    if (g.result === "win") wins++;
    else if (g.result === "loss") losses++;
    else ties++;
    netCubes += g.cubes;
  }
  return {
    games: games.length,
    wins,
    losses,
    ties,
    winRate: wins + losses ? wins / (wins + losses) : null,
    cubeRate: games.length ? netCubes / games.length : null,
    netCubes,
  };
}

export const deckKey = (cards: string[]) => [...new Set(cards)].sort().join(",");

export interface DeckList extends Summary {
  key: string;
  cards: string[];
}

export interface Archetype extends Summary {
  key: string;
  /** Two cards that best set this archetype apart; used for its name. */
  signature: string[];
  /** Cards in at least half of this archetype's games, most common first. */
  coreCards: string[];
  metaShare: number;
  lists: DeckList[];
}

/**
 * Groups decks that share at least `minShared` of 12 cards, starting from the most played list.
 * `cost` breaks ties when naming so the headline cards tend to be the payoffs.
 */
export function clusterDecks<T extends GameForStats>(
  games: T[],
  opts: { minShared?: number; cost?: (defId: string) => number } = {},
): Archetype[] {
  const minShared = opts.minShared ?? 9;
  const cost = opts.cost ?? (() => 0);
  if (games.length === 0) return [];

  const byList = new Map<string, T[]>();
  for (const g of games) {
    const key = deckKey(g.deckCards);
    const bucket = byList.get(key);
    if (bucket) bucket.push(g);
    else byList.set(key, [g]);
  }
  const lists = [...byList.entries()]
    .map(([key, gs]) => ({ key, cards: key.split(","), games: gs }))
    .sort((a, b) => b.games.length - a.games.length || a.key.localeCompare(b.key));

  const clusters: { core: Set<string>; members: typeof lists }[] = [];
  for (const list of lists) {
    const home = clusters.find((c) => list.cards.filter((card) => c.core.has(card)).length >= minShared);
    if (home) home.members.push(list);
    else clusters.push({ core: new Set(list.cards), members: [list] });
  }

  const globalFreq = cardFrequency(games);

  return clusters
    .map((c) => {
      const clusterGames = c.members.flatMap((m) => m.games);
      const freq = cardFrequency(clusterGames);
      const ranked = [...freq.entries()].sort(
        (a, b) => b[1] - a[1] || cost(b[0]) - cost(a[0]) || a[0].localeCompare(b[0]),
      );
      const signature = ranked
        .filter(([, f]) => f >= 0.6)
        // Common in this archetype AND rarer elsewhere; squaring f favours cards in every version of the deck.
        .map(([card, f]) => ({ card, score: (f * f) / (globalFreq.get(card) ?? 1) }))
        .sort((a, b) => b.score - a.score || cost(b.card) - cost(a.card) || a.card.localeCompare(b.card))
        .slice(0, 2)
        .map((s) => s.card);
      return {
        key: c.members[0].key,
        signature,
        coreCards: ranked.filter(([, f]) => f >= 0.5).map(([card]) => card),
        metaShare: clusterGames.length / games.length,
        lists: c.members.map((m) => ({ key: m.key, cards: m.cards, ...summarize(m.games) })),
        ...summarize(clusterGames),
      };
    })
    .sort((a, b) => b.games - a.games || a.key.localeCompare(b.key));
}

function cardFrequency(games: GameForStats[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const g of games) for (const card of new Set(g.deckCards)) counts.set(card, (counts.get(card) ?? 0) + 1);
  const freq = new Map<string, number>();
  for (const [card, n] of counts) freq.set(card, n / (games.length || 1));
  return freq;
}

export interface CardStat {
  defId: string;
  games: number;
  playRate: number;
  winRate: number | null;
  cubeRate: number | null;
  drawnGames: number;
  drawnWinRate: number | null;
  playedGames: number;
  playedWinRate: number | null;
}

export function cardStats(games: GameForStats[]): CardStat[] {
  const inDeck = new Map<string, GameForStats[]>();
  const drawn = new Map<string, GameForStats[]>();
  const played = new Map<string, GameForStats[]>();
  const add = (map: Map<string, GameForStats[]>, card: string, g: GameForStats) => {
    const list = map.get(card);
    if (list) list.push(g);
    else map.set(card, [g]);
  };
  for (const g of games) {
    for (const card of new Set(g.deckCards)) add(inDeck, card, g);
    for (const card of new Set(g.cardsDrawn)) if (g.deckCards.includes(card)) add(drawn, card, g);
    for (const card of new Set(g.cardsPlayed)) if (g.deckCards.includes(card)) add(played, card, g);
  }
  return [...inDeck.entries()]
    .map(([defId, gs]) => {
      const s = summarize(gs);
      const d = summarize(drawn.get(defId) ?? []);
      const p = summarize(played.get(defId) ?? []);
      return {
        defId,
        games: s.games,
        playRate: s.games / games.length,
        winRate: s.winRate,
        cubeRate: s.cubeRate,
        drawnGames: d.games,
        drawnWinRate: d.winRate,
        playedGames: p.games,
        playedWinRate: p.winRate,
      };
    })
    .sort((a, b) => b.games - a.games || a.defId.localeCompare(b.defId));
}

export interface CubeGame {
  result: "win" | "loss" | "tie";
  cubes: number;
  snapped: boolean;
  opponentSnapped: boolean;
  conceded: boolean;
  opponentConceded: boolean;
}

export interface Bleed {
  games: number;
  /** Cubes handed over, as a positive number, because "lost 4.2" reads better than "-4.2". */
  cubes: number;
  perGame: number | null;
}

export interface CubeDiscipline {
  /** Games you raised the stakes in. */
  snapped: Summary;
  /** They raised and you did not, so you chose to see it. */
  calledTheirSnap: Summary;
  /** Nobody raised: the baseline your other numbers should be read against. */
  quiet: Summary;
  /** Losses you retreated out of. */
  retreated: Bleed;
  /** Losses you sat through to the end. The gap between these two is the whole point. */
  playedOut: Bleed;
  retreatRate: number | null;
  /** The mirror of retreatRate: how often they walked away from you. */
  foldRate: number | null;
  /** Cubes won from games they retreated out of, and how many of your wins those were. */
  theyFolded: Bleed;
}

const bleed = (games: CubeGame[]): Bleed => {
  const cubes = games.reduce((n, g) => n + Math.max(0, -g.cubes), 0);
  return { games: games.length, cubes, perGame: games.length ? cubes / games.length : null };
};

/** The same shape as bleed, counting cubes won rather than handed over. */
const take = (games: CubeGame[]): Bleed => {
  const cubes = games.reduce((n, g) => n + Math.max(0, g.cubes), 0);
  return { games: games.length, cubes, perGame: games.length ? cubes / games.length : null };
};

/**
 * Where the cubes actually go.
 *
 * Win rate is the wrong headline for this game: you can win most of your matches and still
 * lose cubes, because the skill is in raising and in walking away. All of it is already on
 * every uploaded game and none of it was being read.
 *
 * The number worth looking at is the gap between what a retreat costs and what sitting
 * through a loss costs. If the second is much bigger, the cubes are going somewhere a
 * different decision would have kept them.
 */
export function cubeDiscipline(games: CubeGame[]): CubeDiscipline {
  const losses = games.filter((g) => g.result === "loss");
  return {
    snapped: summarize(games.filter((g) => g.snapped)),
    calledTheirSnap: summarize(games.filter((g) => g.opponentSnapped && !g.snapped)),
    quiet: summarize(games.filter((g) => !g.snapped && !g.opponentSnapped)),
    retreated: bleed(losses.filter((g) => g.conceded)),
    playedOut: bleed(losses.filter((g) => !g.conceded)),
    retreatRate: games.length ? games.filter((g) => g.conceded).length / games.length : null,
    // Recorded per side by the game and read by nothing until now. A game stored before the
    // column existed reads as false, which is indistinguishable from an opponent who played
    // on, so this understates on old history rather than inventing folds.
    foldRate: games.length ? games.filter((g) => g.opponentConceded).length / games.length : null,
    theyFolded: take(games.filter((g) => g.opponentConceded)),
  };
}

/** One location, across every game it turned up in. */
export interface LocationRecord {
  location: string;
  /** Games this location appeared in AND the lane result was recorded. */
  games: number;
  /** Lanes won there. */
  won: number;
  winRate: number | null;
  /** Average power committed here, over the lanes that recorded any. */
  power: number | null;
}

/** The shape locationRecords needs, so aggregate stays clear of the parser's types. */
interface LocationLane {
  location: string | null;
  won?: boolean;
  powerPlayed?: number | null;
}

/**
 * How often you win each location.
 *
 * The game records only that a location was won, never that it was lost, so a lane that is not
 * won covers both losing it and tying it. Say "won" and "not won"; there is nothing in the file
 * that separates the two.
 *
 * A zone stored before lane results were read has no `won` at all, and counting that as a loss
 * would quietly drag every rate down, so those zones are skipped and `games` counts only what
 * was actually recorded.
 */
export function locationRecords(boards: LocationLane[][]): LocationRecord[] {
  const byId = new Map<string, { games: number; won: number; power: number; powered: number }>();
  for (const zone of boards.flat()) {
    if (!zone.location || typeof zone.won !== "boolean") continue;
    const rec = byId.get(zone.location) ?? { games: 0, won: 0, power: 0, powered: 0 };
    rec.games += 1;
    if (zone.won) rec.won += 1;
    if (typeof zone.powerPlayed === "number") {
      rec.power += zone.powerPlayed;
      rec.powered += 1;
    }
    byId.set(zone.location, rec);
  }
  return [...byId.entries()]
    .map(([location, r]) => ({
      location,
      games: r.games,
      won: r.won,
      winRate: r.games ? r.won / r.games : null,
      power: r.powered ? r.power / r.powered : null,
    }))
    .sort((a, b) => b.games - a.games || a.location.localeCompare(b.location));
}
