import { getDb } from "@/lib/db";
import { getCards } from "@/lib/cards/queries";
import type { Card } from "@/lib/cards/types";
import {
  cardStats,
  clusterDecks,
  cubeDiscipline,
  locationRecords,
  summarize,
  type Archetype,
  type CardStat,
  type CubeDiscipline,
  type GameForStats,
  type LocationRecord,
  type Summary,
} from "./aggregate";
import type { BoardZone } from "./parse-game";

export const STAT_WINDOWS = { "7d": 7, "30d": 30, all: null } as const;
export type StatWindow = keyof typeof STAT_WINDOWS;

interface GameRow {
  id: number;
  tracker_id: number;
  played_at: Date;
  league: string | null;
  battle_mode: boolean;
  result: "win" | "loss" | "tie";
  cubes: number;
  final_cube_value: number;
  snapped: boolean;
  opponent_snapped: boolean;
  conceded: boolean;
  /** False also means "recorded before this was captured", so count it, do not assume it. */
  opponent_conceded: boolean;
  turns: number | null;
  deck_name: string | null;
  deck_cards: string[];
  opponent_name: string | null;
  opponent_cards: string[];
  cards_drawn: string[];
  cards_played: string[];
  locations: string[];
  board: BoardZone[] | string | null;
}

/** Drivers differ on whether jsonb arrives parsed, and older rows have no board at all. */
function toBoard(value: BoardZone[] | string | null): BoardZone[] {
  const parsed = typeof value === "string" ? safeJson(value) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (z): z is BoardZone =>
      !!z && typeof z === "object" && Array.isArray(z.player) && Array.isArray(z.opponent),
  );
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const toStatsGame = (r: GameRow): GameForStats & { row: GameRow } => ({
  deckCards: r.deck_cards,
  result: r.result,
  cubes: r.cubes,
  cardsDrawn: r.cards_drawn ?? [],
  cardsPlayed: r.cards_played ?? [],
  row: r,
});

async function loadGames(opts: {
  window: StatWindow;
  league?: string | null;
  /** Empty means every tracker, which is what the public meta stats want. */
  trackerIds?: number[];
  limit?: number;
}) {
  const days = STAT_WINDOWS[opts.window];
  const db = await getDb();
  return db.query<GameRow>(
    `select id, tracker_id, played_at, league, battle_mode, result, cubes, final_cube_value, snapped,
            opponent_snapped, conceded, opponent_conceded, turns, deck_name, deck_cards, opponent_name, opponent_cards, cards_drawn,
            cards_played, locations, board
       from tracked_games
      where not friendly
        and ($1::timestamptz is null or played_at >= $1)
        and ($2::text is null or coalesce(league, 'Unknown') = $2)
        and ($3::int[] = '{}'::int[] or tracker_id = any($3::int[]))
      order by played_at desc
      limit $4`,
    [
      days ? new Date(Date.now() - days * 86_400_000) : null,
      opts.league ?? null,
      opts.trackerIds ?? [],
      opts.limit ?? 50_000,
    ],
  );
}

export interface NamedArchetype extends Archetype {
  name: string;
}

function nameArchetypes(archetypes: Archetype[], byId: Map<string, Card>): NamedArchetype[] {
  return archetypes.map((a) => ({
    ...a,
    name: a.signature.map((id) => byId.get(id)?.name ?? id).join(" / ") || "Unnamed",
  }));
}

export interface MetaStats {
  latestGameAt: string | null;
  window: StatWindow;
  league: string | null;
  leagues: { league: string; games: number }[];
  trackers: number;
  summary: Summary;
  archetypes: NamedArchetype[];
  cards: CardStat[];
  cardInfo: Record<string, Pick<Card, "name" | "art" | "cost">>;
}

export async function getMetaStats(window: StatWindow, league: string | null): Promise<MetaStats> {
  const db = await getDb();
  const [rows, allCards, leagues] = await Promise.all([
    loadGames({ window, league }),
    getCards(),
    db.query<{ league: string; games: number }>(
      `select coalesce(league, 'Unknown') as league, count(*)::int as games from tracked_games
        where not friendly group by 1 order by 2 desc`,
    ),
  ]);
  const byId = new Map(allCards.map((c) => [c.defId, c]));
  const games = rows.map(toStatsGame);
  const archetypes = nameArchetypes(clusterDecks(games, { cost: (id) => byId.get(id)?.cost ?? 0 }), byId);
  const cards = cardStats(games);

  const used = new Set<string>([...cards.map((c) => c.defId), ...archetypes.flatMap((a) => a.coreCards)]);
  const cardInfo: MetaStats["cardInfo"] = {};
  for (const id of used) {
    const c = byId.get(id);
    if (c) cardInfo[id] = { name: c.name, art: c.art, cost: c.cost };
  }

  return {
    window,
    league,
    leagues,
    trackers: new Set(rows.map((r) => r.tracker_id)).size,
    latestGameAt: rows[0]?.played_at.toISOString() ?? null,
    summary: summarize(games),
    archetypes,
    cards,
    cardInfo,
  };
}

export interface PersonalGame {
  id: number;
  playedAt: string;
  league: string | null;
  result: "win" | "loss" | "tie";
  cubes: number;
  snapped: boolean;
  opponentSnapped: boolean;
  /** You retreated. The tracker has always recorded it; nothing read it until now. */
  conceded: boolean;
  /** They retreated. */
  opponentConceded: boolean;
  turns: number | null;
  deckName: string | null;
  deckCards: string[];
  opponentName: string | null;
  opponentCards: string[];
  /** Empty for games recorded before the board was captured. */
  board: BoardZone[];
}

export interface PersonalStats {
  locationInfo?: Record<string, string>;
  tracker: { id: number; name: string };
  window: StatWindow;
  summary: Summary;
  /** Where the cubes go: raising, calling a raise, and walking away. */
  cubes: CubeDiscipline;
  /** How often each location was won. Empty until games carry lane results. */
  locations: LocationRecord[];
  decks: (Summary & { key: string; name: string; cards: string[]; lastPlayed: string })[];
  cubesOverTime: { at: string; total: number }[];
  recent: PersonalGame[];
  cardInfo: Record<string, Pick<Card, "name" | "art" | "cost">>;
}

/**
 * One person's games. Signed in that is every tracker key on their account, so stats follow
 * them between devices; with a bare key it is just that one.
 */
export async function getPersonalStats(
  subject: { id: number; name: string; trackerIds: number[] },
  window: StatWindow,
): Promise<PersonalStats> {
  // No keys yet means no games, not everyone's games.
  if (subject.trackerIds.length === 0) {
    return {
      tracker: { id: subject.id, name: subject.name },
      window,
      summary: summarize([]),
      cubes: cubeDiscipline([]),
      locations: [],
      decks: [],
      cubesOverTime: [],
      recent: [],
      cardInfo: {},
    };
  }
  const [rows, allCards] = await Promise.all([loadGames({ window, trackerIds: subject.trackerIds }), getCards()]);
  // Name only the locations these games were played on. Selecting every released location ran
  // after the Promise.all rather than inside it, and then shipped all of them to the browser on
  // every render, though BoardView reads at most three per game the reader expands.
  const playedOn = [...new Set(rows.flatMap((r) => r.locations ?? []))];
  const db = await getDb();
  const locations = playedOn.length
    ? await db.query<{def_id: string; name: string}>(
        "select def_id,name from locations where def_id = any($1::text[])", [playedOn])
    : [];
  const locationInfo = Object.fromEntries(locations.map(l => [l.def_id,l.name]));
  const byId = new Map(allCards.map((c) => [c.defId, c]));
  const games = rows.map(toStatsGame);

  const decks = new Map<string, typeof games>();
  for (const g of games) {
    const key = [...new Set(g.deckCards)].sort().join(",");
    const list = decks.get(key);
    if (list) list.push(g);
    else decks.set(key, [g]);
  }

  let total = 0;
  const cubesOverTime = [...rows].reverse().map((r) => {
    total += r.cubes;
    return { at: r.played_at.toISOString(), total };
  });

  const recent = rows.slice(0, 50).map<PersonalGame>((r) => ({
    id: r.id,
    playedAt: r.played_at.toISOString(),
    league: r.league,
    result: r.result,
    cubes: r.cubes,
    snapped: r.snapped,
    opponentSnapped: r.opponent_snapped,
    conceded: r.conceded,
    opponentConceded: r.opponent_conceded,
    turns: r.turns,
    deckName: r.deck_name,
    deckCards: r.deck_cards,
    opponentName: r.opponent_name,
    opponentCards: r.opponent_cards,
    board: toBoard(r.board),
  }));

  const used = new Set<string>([
    ...rows.flatMap((r) => r.deck_cards),
    ...recent.flatMap((g) => g.opponentCards),
    ...recent.flatMap((g) => g.board.flatMap((z) => [...z.player, ...z.opponent])),
  ]);
  const cardInfo: PersonalStats["cardInfo"] = {};
  for (const id of used) {
    const c = byId.get(id);
    if (c) cardInfo[id] = { name: c.name, art: c.art, cost: c.cost };
  }

  return {
    tracker: { id: subject.id, name: subject.name },
    locationInfo,
    window,
    summary: summarize(games),
    cubes: cubeDiscipline(
      rows.map((r) => ({
        result: r.result,
        cubes: r.cubes,
        snapped: r.snapped,
        opponentSnapped: r.opponent_snapped,
        conceded: r.conceded,
        opponentConceded: r.opponent_conceded,
      })),
    ),
    locations: locationRecords(rows.map((r) => toBoard(r.board))),
    decks: [...decks.entries()]
      .map(([key, gs]) => ({
        key,
        // rows are newest first, so gs[0] is the most recent game with this list
        name: gs[0].row.deck_name ?? "Unnamed deck",
        cards: gs[0].deckCards,
        lastPlayed: gs[0].row.played_at.toISOString(),
        ...summarize(gs),
      }))
      .sort((a, b) => b.games - a.games),
    cubesOverTime,
    recent,
    cardInfo,
  };
}
