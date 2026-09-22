// Reads a finished game out of Marvel Snap's PC state file:
//   %USERPROFILE%\AppData\LocalLow\Second Dinner\SNAP\Standalone\States\nvprod\GameState.json
//
// Field paths follow the parsing map published by the open-source Marvel Snap Tracker
// (github.com/Razviar/marvelsnaptracker; map at marvelsnap.pro/snap/json/parsing_metadata.json). No code is copied.
// The file is written by Json.NET with reference handling, so objects can be replaced by
// {"$ref": "12"} pointers to an earlier {"$id": "12", ...} and arrays may be wrapped as {"$values": [...]}.

export interface ParsedGame {
  gameId: string;
  /** Resolved local Snap identity, used only for hashing on ingest; never returned by the API. */
  accountId: string | null;
  league: string | null;
  battleMode: boolean;
  friendly: boolean;
  result: "win" | "loss" | "tie";
  /** Net cubes for this player: +won, -lost, 0 for a tie. */
  cubes: number;
  finalCubeValue: number;
  conceded: boolean;
  /** The opponent retreated. The game records it per side; only our own was ever read. */
  opponentConceded: boolean;
  snapped: boolean;
  opponentSnapped: boolean;
  turns: number | null;
  totalTurns: number | null;
  deckName: string | null;
  deckCards: string[];
  /** The uploader's own display name, straight off their client info in the file. */
  playerName: string | null;
  opponentName: string | null;
  opponentCards: string[];
  cardsDrawn: string[];
  cardsPlayed: string[];
  locations: string[];
  /** How the three locations looked when the game ended, in the game's own left-to-right order. */
  board: BoardZone[];
}

export interface BoardZone {
  /** null when the game didn't name this location, so the cards still render without it. */
  location: string | null;
  player: string[];
  opponent: string[];
  /**
   * Whether the uploader won this location. The game only writes IsWinner when it is true, so
   * false covers both losing the location and tying it; there is nothing in the file that
   * separates those. Say "won" and "not won", never "lost".
   */
  won: boolean;
  /** Total power the uploader committed here, or null for a game recorded before this. */
  powerPlayed: number | null;
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
  // "None" is the game's null card ID, written wherever a slot is empty or a draw was not
  // known. It is not a card, and it was being stored as one in every game's cards_drawn.
  const named = (id: string) => (id && id !== "None" ? id : null);
  const cardId = (v: Json): string | null => {
    const cur = deref(v);
    if (typeof cur === "string") return named(cur);
    if (isObj(cur) && typeof cur.CardDefId === "string") return named(cur.CardDefId);
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

  // The file names its own client, so who is local does not depend on the uploader sending a
  // header. It used to: without one the fallback below decided, and the fallback was reading a
  // field that does not exist, so it always landed on players[0] and reported the local player
  // as the opponent. An explicit account id still wins, for a file fetched some other way.
  const clientAccount = String(get(remote, "ClientPlayerInfo", "AccountId") ?? "");
  const byAccount = (wanted: string) =>
    wanted ? players.findIndex((p) => String(get(p, "PlayerInfo", "AccountId") ?? "") === wanted) : -1;
  let localIndex = byAccount(accountId ?? "");
  // The header overrides the file, but only when it names somebody the file actually contains.
  // A header matching nobody is a typo or a guess, and taking it at face value would mint a
  // fresh identity for every bad value instead of falling through to the file's own client.
  const headerIsLocal =
    !!accountId &&
    (localIndex >= 0 || items.some((it) => String(get(it, "AccountId") ?? "") === accountId));
  if (localIndex < 0) localIndex = byAccount(clientAccount);

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

  // The uploader's Snap account id, taken only from something that names them: the header
  // override, the file naming its own client, or the single result entry carrying a deck,
  // since only the local player's does. Never from players[localIndex]. That index falls back
  // to the deck-overlap guess below, which always returns 0 or 1 and so is confidently wrong
  // half the time it is reached, and players[wrong].PlayerInfo.AccountId is the opponent's
  // real account id. Hashed downstream, that files the game under their identity and writes a
  // snap_names row pairing their account with the uploader's display name, since playerName
  // comes from ClientPlayerInfo and does not move with the guess. snap_names is the only
  // direct rename evidence the site has and it feeds a one-way merge, so a wrong row there is
  // not recoverable. Nothing here is better than a guess: with no id the caller hashes per
  // tracker key, which cannot collide with another person.
  const localAccount =
    (headerIsLocal && accountId) ||
    clientAccount ||
    (withDeck.length === 1 ? String(get(withDeck[0], "AccountId") ?? "") : "");

  const finalCubeValue = Number(get(result, "FinalCubeValue"));
  if (!Number.isFinite(finalCubeValue)) {
    return { ok: false, reason: "missing-fields", detail: "No FinalCubeValue in the game result" };
  }

  // Cards each side had at the three locations at the end of the game, kept per location so
  // the board can be shown as it stood, then flattened for the whole-game card lists. Every
  // card carries an Owner pointing back at a player, which is what splits the two sides; a
  // card whose owner resolves to neither is dropped rather than guessed at.
  const locations = list(get(state, "_locations"));
  const playerKeys = players.map(playerKey);
  const zones = locations.map((loc) => {
    const side: [string[], string[]] = [[], []];
    for (const card of list(get(loc, "_cards"))) {
      const id = cardId(card);
      if (!id) continue;
      const owner = playerKeys.indexOf(playerKey(get(card, "Owner")));
      if (owner === 0 || owner === 1) side[owner].push(id);
    }
    return [unique(side[0]), unique(side[1])];
  });
  const sides = [unique(zones.flatMap((z) => z[0])), unique(zones.flatMap((z) => z[1]))];
  if (localIndex < 0) {
    const overlap = (cards: string[]) => cards.filter((c) => deckCards.includes(c)).length;
    localIndex = overlap(sides[1]) > overlap(sides[0]) ? 1 : 0;
  }
  const opponentIndex = localIndex === 0 ? 1 : 0;
  const opponent = players[opponentIndex];

  const isWinner = get(item, "IsWinner") === true;
  const isLoser = get(item, "IsLoser") === true;
  const outcome: ParsedGame["result"] = isWinner ? "win" : isLoser ? "loss" : "tie";

  // Each location carries its own LocationDefId, so the name comes off the location the cards
  // came from rather than from lining two lists up by index. LocationDefIdsAtEndOfGame is the
  // fallback, and is still what a game with no locations in state reports.
  //
  // The second and third locations turn over on turns two and three, and a game that ends
  // before then reports them as RevealOn2 and RevealOn3. Those are the game saying "nobody saw
  // this", not location IDs: they match nothing in the locations table, so the site fell back
  // to prettifying the ID and showed "Reveal On 2" next to a real location name, and stored
  // them in tracked_games.locations where anything counting locations would count them. A
  // location nobody saw is no location, which the board already knows how to draw.
  const revealed = (id: unknown): string | null =>
    typeof id === "string" && id && !/^RevealOn\d+$/.test(id) ? id : null;
  const endOfGameIds = list(get(result, "LocationDefIdsAtEndOfGame")).map(revealed);
  const locationIds = locations.length
    ? locations.map((loc, i) => revealed(get(loc, "LocationDefId")) ?? endOfGameIds[i] ?? null)
    : endOfGameIds;
  // LocationResults is the uploader's own record per location, in the same left-to-right order
  // as the locations: on every real file its CardsPlayed matches the number of that player's
  // cards in the matching zone. An entry is missing or bare when nothing was played there.
  const laneResults = list(get(item, "LocationResults"));
  const board: BoardZone[] = zones.map((z, i) => {
    const lane = laneResults[i];
    const power = get(lane, "PowerPlayed");
    return {
      location: locationIds[i] ?? null,
      player: z[localIndex],
      opponent: z[opponentIndex],
      won: get(lane, "IsWinner") === true,
      powerPlayed: typeof power === "number" && Number.isFinite(power) ? power : null,
    };
  });

  const name = get(opponent, "PlayerInfo", "Name");
  const clientName = get(remote, "ClientPlayerInfo", "Name");
  const deckName = get(item, "Deck", "Name");
  const league = get(result, "LeagueDefId");

  return {
    ok: true,
    game: {
      gameId: String(rawGameId),
      accountId: localAccount || null,
      league: typeof league === "string" && league ? league : null,
      battleMode: get(result, "IsBattleMode") === true,
      friendly: get(result, "IsBattleFriendMode") === true,
      result: outcome,
      cubes: outcome === "win" ? Math.abs(finalCubeValue) : outcome === "loss" ? -Math.abs(finalCubeValue) : 0,
      finalCubeValue: Math.abs(finalCubeValue),
      conceded: get(item, "Conceded") === true,
      opponentConceded: get(item, "OpponentConceded") === true,
      // Both sides of the snap come from fields the real file actually carries. This read
      // `item._stakesRaised`, which appears nowhere in a real GameState.json: the result entry
      // spells it `StakesRaised`, with no underscore. So snapped came back false on every
      // upload ever recorded, and the synthetic fixture agreed because it had been written to
      // match the code rather than the game, exactly as the `_to` board did.
      // The result entry is keyed by the uploader's own AccountId, so it is the better source;
      // the player's own turn list is the same field opponentSnapped has always used, and
      // covers a file whose entry omits the flag.
      snapped:
        truthy(get(item, "StakesRaised")) ||
        truthy(get(players[localIndex], "_turnsOnStakesRaiseRequested")),
      opponentSnapped: truthy(get(opponent, "_turnsOnStakesRaiseRequested")),
      turns: toInt(get(result, "TurnsTaken")),
      totalTurns: toInt(get(result, "TotalTurns")),
      deckName: typeof deckName === "string" && deckName ? deckName.slice(0, 60) : null,
      deckCards,
      playerName: typeof clientName === "string" && clientName ? clientName.slice(0, 40) : null,
      opponentName: typeof name === "string" && name ? name.slice(0, 40) : null,
      opponentCards: sides[opponentIndex],
      // From the uploader's own result entry, not ClientPlayerInfo. Those lists are an event
      // log covering BOTH players: on one of these games "cards you played" carried Domino,
      // Jubilee, Wave, WarMachine and Infinaut, none of which were in the uploader's deck. The
      // result entry holds only their own cards, and on all four real files it matches
      // ClientPlayerInfo exactly once the opponent's cards and the None placeholders are out.
      cardsDrawn: cardIds(get(item, "CardDefIdsDrawn")),
      cardsPlayed: cardIds(get(item, "CardDefIdsPlayed")),
      locations: unique(locationIds),
      board,
    },
  };

  /** Identifies a player object across $ref links, by account id and then entity id. */
  function playerKey(v: Json): string {
    const p = deref(v);
    const account = get(p, "PlayerInfo", "AccountId");
    if (typeof account === "string" && account) return `a:${account}`;
    const entity = get(p, "EntityId");
    return entity === null || entity === undefined ? "" : `e:${String(entity)}`;
  }

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
