// Reads a finished game out of Marvel Snap's PC state file:
//   %USERPROFILE%\AppData\LocalLow\Second Dinner\SNAP\Standalone\States\nvprod\GameState.json
//
// Field paths follow the parsing map published by the open-source Marvel Snap Tracker
// (github.com/Razviar/marvelsnaptracker; map at marvelsnap.pro/snap/json/parsing_metadata.json). No code is copied.
// The file is written by Json.NET with reference handling, so objects can be replaced by
// {"$ref": "12"} pointers to an earlier {"$id": "12", ...} and arrays may be wrapped as {"$values": [...]}.

export interface ParsedGame {
  gameId: string;
  league: string | null;
  battleMode: boolean;
  friendly: boolean;
  result: "win" | "loss" | "tie";
  /** Net cubes for this player: +won, -lost, 0 for a tie. */
  cubes: number;
  finalCubeValue: number;
  conceded: boolean;
  snapped: boolean;
  opponentSnapped: boolean;
  turns: number | null;
  totalTurns: number | null;
  deckName: string | null;
  deckCards: string[];
  opponentName: string | null;
  opponentCards: string[];
  cardsDrawn: string[];
  cardsPlayed: string[];
  locations: string[];
}

export type ParseResult =
  | { ok: true; game: ParsedGame }
  | { ok: false; reason: "invalid-json" | "no-result" | "missing-fields"; detail: string };

type Json = unknown;

const BOM = String.fromCharCode(0xfeff);

export function parseGameState(text: string, accountId?: string | null): ParseResult {
  let root: Json;
  try {
    root = JSON.parse(text.startsWith(BOM) ? text.slice(1) : text);
  } catch (err) {
    // The game may still be writing the file; the tracker retries.
    return { ok: false, reason: "invalid-json", detail: String(err).slice(0, 200) };
  }

  const refs = indexRefs(root);
  const deref = (v: Json): Json => {
    let cur = v;
    for (let i = 0; i < 20 && isObj(cur) && "$ref" in cur; i++) cur = refs.get(String(cur.$ref));
    return cur;
  };
  const get = (v: Json, ...path: (string | number)[]): Json => {
    let cur = deref(v);
    for (const key of path) {
      if (Array.isArray(cur)) cur = cur[key as number];
      else if (isObj(cur)) {
        const values = cur.$values;
        cur = typeof key === "number" && Array.isArray(values) ? values[key] : cur[key];
      } else return undefined;
      cur = deref(cur);
    }
    return cur;
  };
  const list = (v: Json): Json[] => {
    const cur = deref(v);
    if (Array.isArray(cur)) return cur;
    if (isObj(cur) && Array.isArray(cur.$values)) return cur.$values;
    return [];
  };
  const cardId = (v: Json): string | null => {
    const cur = deref(v);
    if (typeof cur === "string") return cur || null;
    if (isObj(cur) && typeof cur.CardDefId === "string") return cur.CardDefId || null;
    return null;
  };
  const cardIds = (v: Json) => unique(list(v).map(cardId));

  const remote = get(root, "RemoteGame");
  const state = get(remote, "GameState");
  const result = get(state, "ClientResultMessage");
  const rawGameId = get(result, "GameId");
  if (typeof rawGameId !== "string" && typeof rawGameId !== "number") {
    return { ok: false, reason: "no-result", detail: "GameState.json has no finished game (ClientResultMessage.GameId)" };
  }

  const players = list(get(state, "_players"));
  const items = list(get(result, "GameResultAccountItems"));

  let localIndex = accountId
    ? players.findIndex((p) => String(get(p, "PlayerInfo", "AccountId") ?? "") === accountId)
    : -1;

  // Only the local player's result entry carries a deck list; prefer an account match, then that.
  const withDeck = items.filter((it) => cardIds(get(it, "Deck", "Cards")).length > 0);
  const item =
    (accountId ? items.find((it) => String(get(it, "AccountId") ?? "") === accountId) : undefined) ??
    (withDeck.length === 1 ? withDeck[0] : undefined) ??
    (localIndex >= 0 ? items[localIndex] : undefined) ??
    items[0];
  if (!item) return { ok: false, reason: "missing-fields", detail: "No GameResultAccountItems" };

  const deckCards = cardIds(get(item, "Deck", "Cards"));
  if (deckCards.length === 0) return { ok: false, reason: "missing-fields", detail: "No deck in the game result" };

  const finalCubeValue = Number(get(result, "FinalCubeValue"));
  if (!Number.isFinite(finalCubeValue)) {
    return { ok: false, reason: "missing-fields", detail: "No FinalCubeValue in the game result" };
  }

  // Cards each side had at the three locations at the end of the game.
  const locations = list(get(state, "_to"));
  const side = (n: 1 | 2) => unique(locations.flatMap((loc) => list(get(loc, `_player${n}Cards`)).map(cardId)));
  const sides = [side(1), side(2)];
  if (localIndex < 0) {
    const overlap = (cards: string[]) => cards.filter((c) => deckCards.includes(c)).length;
    localIndex = overlap(sides[1]) > overlap(sides[0]) ? 1 : 0;
  }
  const opponentIndex = localIndex === 0 ? 1 : 0;
  const opponent = players[opponentIndex];

  const isWinner = get(item, "IsWinner") === true;
  const isLoser = get(item, "IsLoser") === true;
  const outcome: ParsedGame["result"] = isWinner ? "win" : isLoser ? "loss" : "tie";

  const name = get(opponent, "PlayerInfo", "Name");
  const deckName = get(item, "Deck", "Name");
  const league = get(result, "LeagueDefId");

  return {
    ok: true,
    game: {
      gameId: String(rawGameId),
      league: typeof league === "string" && league ? league : null,
      battleMode: get(result, "IsBattleMode") === true,
      friendly: get(result, "IsBattleFriendMode") === true,
      result: outcome,
      cubes: outcome === "win" ? Math.abs(finalCubeValue) : outcome === "loss" ? -Math.abs(finalCubeValue) : 0,
      finalCubeValue: Math.abs(finalCubeValue),
      conceded: get(item, "Conceded") === true,
      snapped: truthy(get(item, "_stakesRaised")),
      opponentSnapped: truthy(get(opponent, "_turnsOnStakesRaiseRequested")),
      turns: toInt(get(result, "TurnsTaken")),
      totalTurns: toInt(get(result, "TotalTurns")),
      deckName: typeof deckName === "string" && deckName ? deckName.slice(0, 60) : null,
      deckCards,
      opponentName: typeof name === "string" && name ? name.slice(0, 40) : null,
      opponentCards: sides[opponentIndex],
      cardsDrawn: cardIds(get(remote, "ClientPlayerInfo", "CardsDrawn")),
      cardsPlayed: cardIds(get(remote, "ClientPlayerInfo", "CardsPlayed")),
      locations: unique(list(get(result, "LocationDefIdsAtEndOfGame")).map((l) => (typeof l === "string" ? l : null))),
    },
  };

  function truthy(v: Json): boolean {
    const cur = deref(v);
    if (Array.isArray(cur)) return cur.length > 0;
    if (isObj(cur) && Array.isArray(cur.$values)) return cur.$values.length > 0;
    return cur === true || (typeof cur === "number" && cur > 0);
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function indexRefs(root: unknown): Map<string, unknown> {
  const map = new Map<string, unknown>();
  const stack: unknown[] = [root];
  while (stack.length) {
    const v = stack.pop();
    if (Array.isArray(v)) {
      for (const x of v) if (typeof x === "object" && x !== null) stack.push(x);
    } else if (isObj(v)) {
      if (typeof v.$id === "string" || typeof v.$id === "number") map.set(String(v.$id), v);
      for (const x of Object.values(v)) if (typeof x === "object" && x !== null) stack.push(x);
    }
  }
  return map;
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}

function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
