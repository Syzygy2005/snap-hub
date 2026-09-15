import { getDb } from "@/lib/db";
import { getCards } from "@/lib/cards/queries";
import type { Card } from "@/lib/cards/types";
import { cardStats, clusterDecks, summarize, type Archetype, type CardStat, type GameForStats, type Summary } from "./aggregate";

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
  turns: number | null;
  deck_name: string | null;
  deck_cards: string[];
  opponent_name: string | null;
  opponent_cards: string[];
  cards_drawn: string[];
  cards_played: string[];
  locations: string[];
}

const toStatsGame = (r: GameRow): GameForStats & { row: GameRow } => ({
  deckCards: r.deck_cards,
  result: r.result,
  cubes: r.cubes,
  cardsDrawn: r.cards_drawn ?? [],
  cardsPlayed: r.cards_played ?? [],
  row: r,
});

async function loadGames(opts: { window: StatWindow; league?: string | null; trackerId?: number; limit?: number }) {
  const days = STAT_WINDOWS[opts.window];
  const db = await getDb();
  return db.query<GameRow>(
    `select id, tracker_id, played_at, league, battle_mode, result, cubes, final_cube_value, snapped,
            opponent_snapped, turns, deck_name, deck_cards, opponent_name, opponent_cards, cards_drawn,
            cards_played, locations
       from tracked_games
      where not friendly
        and ($1::timestamptz is null or played_at >= $1)
        and ($2::text is null or coalesce(league, 'Unknown') = $2)
        and ($3::int is null or tracker_id = $3)
      order by played_at desc
      limit $4`,
    [
      days ? new Date(Date.now() - days * 86_400_000) : null,
      opts.league ?? null,
      opts.trackerId ?? null,
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
  turns: number | null;
  deckName: string | null;
  deckCards: string[];
  opponentName: string | null;
  opponentCards: string[];
}

export interface PersonalStats {
  tracker: { id: number; name: string };
  window: StatWindow;
  summary: Summary;
  decks: (Summary & { key: string; name: string; cards: string[]; lastPlayed: string })[];
  cubesOverTime: { at: string; total: number }[];
  recent: PersonalGame[];
  cardInfo: Record<string, Pick<Card, "name" | "art" | "cost">>;
}

export async function getPersonalStats(tracker: { id: number; name: string }, window: StatWindow): Promise<PersonalStats> {
  const [rows, allCards] = await Promise.all([loadGames({ window, trackerId: tracker.id }), getCards()]);
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
    turns: r.turns,
    deckName: r.deck_name,
    deckCards: r.deck_cards,
    opponentName: r.opponent_name,
    opponentCards: r.opponent_cards,
  }));

  const used = new Set<string>([...rows.flatMap((r) => r.deck_cards), ...recent.flatMap((g) => g.opponentCards)]);
  const cardInfo: PersonalStats["cardInfo"] = {};
  for (const id of used) {
    const c = byId.get(id);
    if (c) cardInfo[id] = { name: c.name, art: c.art, cost: c.cost };
  }

  return {
    tracker,
    window,
    summary: summarize(games),
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
