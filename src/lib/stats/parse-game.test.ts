import { describe, expect, it } from "vitest";
import { parseGameState } from "./parse-game";

// Synthetic, but shaped after the real file in fixtures/real-game.json rather than after the
// published field map: locations carry their own cards, and each card points back at its owner.
// The previous version of this builder invented a `_to` array that the game does not produce,
// so these tests passed while every real upload came back with an empty board.
function gameState(
  overrides: {
    localSlot?: 0 | 1;
    withResult?: boolean;
    locationIds?: unknown[];
    namedLocations?: boolean;
    /** null strips AccountId from ClientPlayerInfo, so nothing in the file names the client. */
    clientAccount?: string | null;
    /** Puts an AccountId on the one result entry that carries a deck. */
    itemAccount?: string;
    /** No cards left on the board, as after a turn-one retreat. */
    emptyBoard?: boolean;
    /** The uploader's own per-location record, in the game's left-to-right order. */
    laneResults?: { IsWinner?: boolean; CardsPlayed?: number; PowerPlayed?: number }[];
    /** The opponent walked away. */
    opponentConceded?: boolean;
    /** Turns each side asked to raise the stakes on, as the real file records them. */
    mySnapTurns?: number[];
    theirSnapTurns?: number[];
  } = {},
) {
  const local = overrides.localSlot ?? 0;
  // The real file records a raise on the player, as _turnsOnStakesRaiseRequested, and on the
  // uploader's own result entry, as StakesRaised. It has no _stakesRaised, which is what this
  // builder used to invent and what the parser used to read, so both agreed the uploader never
  // snapped. Same trap as the `_to` board: shape this after the game, not after the code.
  const mySnapTurns = overrides.mySnapTurns ?? [4];
  const theirSnapTurns = overrides.theirSnapTurns ?? [5];
  const me = {
    $id: "p-me",
    EntityId: 7,
    PlayerInfo: { $id: "pi-me", AccountId: "acct-me", Name: "Me" },
    _turnsOnStakesRaiseRequested: mySnapTurns,
  };
  const opp = {
    $id: "p-opp",
    EntityId: 2,
    PlayerInfo: { $id: "pi-opp", AccountId: "acct-opp", Name: "Rival#123" },
    _turnsOnStakesRaiseRequested: theirSnapTurns,
  };
  const players = local === 0 ? [me, opp] : [opp, me];
  const named = overrides.namedLocations ?? true;
  const mine = (card: Record<string, unknown>) => ({ ...card, Owner: { $ref: "p-me" } });
  const theirs = (card: Record<string, unknown>) => ({ ...card, Owner: { $ref: "p-opp" } });
  const location = (name: string, cards: unknown[]) => ({
    ...(named ? { LocationDefId: name } : {}),
    _cards: { $values: overrides.emptyBoard ? [] : cards },
  });
  const clientAccount = overrides.clientAccount === undefined ? "acct-me" : overrides.clientAccount;

  return {
    RemoteGame: {
      $id: "1",
      ClientPlayerInfo: {
        ...(clientAccount === null ? {} : { AccountId: clientAccount }),
        Name: "Me",
        // A real file's ClientPlayerInfo lists are an event log for BOTH players, interleaved
        // with "None" placeholders. The uploader's own cards come off their result entry, so
        // this carries the opponent's plays and a placeholder to prove neither is read.
        CardsDrawn: ["None", "Quicksilver", "None"],
        CardsPlayed: { $id: "cp", $values: [{ CardDefId: "Quicksilver" }, { CardDefId: "None" }] },
      },
      GameState: {
        $id: "2",
        _players: players.map((p) => ({ $ref: p.$id })),
        _allPlayers: players,
        _locations: {
          $values: [
            location("Asgard", [mine({ CardDefId: "AntMan" }), theirs({ CardDefId: "Hulk" })]),
            location("Wakanda", [
              mine({ $id: "card-thanos", CardDefId: "Thanos" }),
              theirs({ CardDefId: "Sunspot" }),
            ]),
            location("Xandar", []),
          ],
        },
        ...(overrides.withResult === false
          ? {}
          : {
              ClientResultMessage: {
                GameId: "game-abc",
                LeagueDefId: "Ranked",
                IsBattleMode: false,
                IsBattleFriendMode: false,
                FinalCubeValue: 4,
                TurnsTaken: 6,
                TotalTurns: 6,
                LocationDefIdsAtEndOfGame: overrides.locationIds ?? ["Asgard", "Wakanda", "Xandar"],
                GameResultAccountItems: [
                  {
                    ...(overrides.itemAccount ? { AccountId: overrides.itemAccount } : {}),
                    CardDefIdsDrawn: ["AntMan", "Thanos", "Wasp"],
                    CardDefIdsPlayed: { $id: "cp2", $values: [{ CardDefId: "AntMan" }, { $ref: "card-thanos" }] },
                    ...(overrides.laneResults ? { LocationResults: overrides.laneResults } : {}),
                    IsWinner: local === 0,
                    IsLoser: local !== 0,
                    Conceded: false,
                    ...(overrides.opponentConceded ? { OpponentConceded: true } : {}),
                    ...(mySnapTurns.length ? { StakesRaised: true, StakesRaisedCount: mySnapTurns.length } : {}),
                    Deck: {
                      Id: "deck-1",
                      Name: "My Thanos",
                      Cards: {
                        $values: [
                          { CardDefId: "AntMan" },
                          { CardDefId: "Thanos" },
                          { CardDefId: "Wasp" },
                          { CardDefId: "Thanos" },
                        ],
                      },
                    },
                  },
                ],
              },
            }),
      },
    },
  };
}

const withBom = (v: unknown) => String.fromCharCode(0xfeff) + JSON.stringify(v);

describe("parseGameState", () => {
  const lane = { won: false, powerPlayed: null };
  const BOARD = [
    { location: "Asgard", player: ["AntMan"], opponent: ["Hulk"], ...lane },
    { location: "Wakanda", player: ["Thanos"], opponent: ["Sunspot"], ...lane },
    { location: "Xandar", player: [], opponent: [], ...lane },
  ];

  it("reads a win, following $ref pointers and $values arrays", () => {
    const res = parseGameState(withBom(gameState()), "acct-me");
    expect(res).toEqual({
      ok: true,
      game: {
        accountId: "acct-me",
        gameId: "game-abc",
        league: "Ranked",
        battleMode: false,
        friendly: false,
        result: "win",
        cubes: 4,
        finalCubeValue: 4,
        conceded: false,
        opponentConceded: false,
        snapped: true,
        opponentSnapped: true,
        turns: 6,
        totalTurns: 6,
        deckName: "My Thanos",
        deckCards: ["AntMan", "Thanos", "Wasp"],
        playerName: "Me",
        opponentName: "Rival#123",
        opponentCards: ["Hulk", "Sunspot"],
        cardsDrawn: ["AntMan", "Thanos", "Wasp"],
        cardsPlayed: ["AntMan", "Thanos"],
        locations: ["Asgard", "Wakanda", "Xandar"],
        board: BOARD,
      },
    });
  });

  it("takes the client from the file when no account ID is sent", () => {
    // The uploader does not have to identify itself: ClientPlayerInfo says who the client is,
    // whichever slot they occupy.
    const res = parseGameState(JSON.stringify(gameState({ localSlot: 1 })));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.game.result).toBe("loss");
    expect(res.game.cubes).toBe(-4);
    expect(res.game.opponentName).toBe("Rival#123");
    expect(res.game.opponentCards).toEqual(["Hulk", "Sunspot"]);
    // The board follows the player, not the slot: their cards stay under "player".
    expect(res.game.board).toEqual(BOARD);
  });

  it("falls back to the deck when nothing in the file names the client either", () => {
    const res = parseGameState(JSON.stringify(gameState({ localSlot: 1, clientAccount: null })));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.game.opponentName).toBe("Rival#123");
    expect(res.game.board).toEqual(BOARD);
  });

  it("reads the uploader's own cards, not the log covering both players", () => {
    // ClientPlayerInfo.CardsDrawn and CardsPlayed are an event log for the whole game: on a
    // real file "cards you played" carried Domino, Jubilee, Wave, WarMachine and Infinaut, none
    // of them in the uploader's deck, plus a "None" placeholder on every single game. The
    // uploader's own cards are on their result entry. Here ClientPlayerInfo holds only the
    // opponent's card and a placeholder, so reading it would be obvious.
    const res = parseGameState(JSON.stringify(gameState()), "acct-me");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.game.cardsDrawn).toEqual(["AntMan", "Thanos", "Wasp"]);
    expect(res.game.cardsPlayed).toEqual(["AntMan", "Thanos"]);
    expect([...res.game.cardsDrawn, ...res.game.cardsPlayed]).not.toContain("Quicksilver");
    expect([...res.game.cardsDrawn, ...res.game.cardsPlayed]).not.toContain("None");
  });

  it("takes each location's result from the uploader's own record", () => {
    const res = parseGameState(
      JSON.stringify(gameState({ laneResults: [{ IsWinner: true, PowerPlayed: 12 }, { PowerPlayed: 4 }, {}] })),
      "acct-me",
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.game.board.map((z) => ({ won: z.won, powerPlayed: z.powerPlayed }))).toEqual([
      { won: true, powerPlayed: 12 },
      // IsWinner is only written when true, so anything else is "not won", never "lost".
      { won: false, powerPlayed: 4 },
      { won: false, powerPlayed: null },
    ]);
  });

  it("records whether the opponent retreated, separately from whether you did", () => {
    const theirs = parseGameState(JSON.stringify(gameState({ opponentConceded: true })), "acct-me");
    expect(theirs.ok && theirs.game).toMatchObject({ conceded: false, opponentConceded: true });
    const neither = parseGameState(JSON.stringify(gameState()), "acct-me");
    expect(neither.ok && neither.game).toMatchObject({ conceded: false, opponentConceded: false });
  });

  it("keeps the two sides of a snap apart", () => {
    // Whether the uploader snapped and whether the opponent did are separate facts. snapped
    // used to read a field that does not exist, so it was false on every real upload while
    // opponentSnapped, which reads the real one, worked. That put every game the uploader
    // snapped into the "neither of us snapped" bucket in the cube panel.
    const theirs = parseGameState(JSON.stringify(gameState({ mySnapTurns: [], theirSnapTurns: [5] })), "acct-me");
    expect(theirs.ok && theirs.game).toMatchObject({ snapped: false, opponentSnapped: true });

    const mine = parseGameState(JSON.stringify(gameState({ mySnapTurns: [4], theirSnapTurns: [] })), "acct-me");
    expect(mine.ok && mine.game).toMatchObject({ snapped: true, opponentSnapped: false });

    const neither = parseGameState(JSON.stringify(gameState({ mySnapTurns: [], theirSnapTurns: [] })), "acct-me");
    expect(neither.ok && neither.game).toMatchObject({ snapped: false, opponentSnapped: false });

    // The uploader's raise is read even from the far slot, where players[localIndex] is the
    // second entry rather than the first.
    const far = parseGameState(JSON.stringify(gameState({ localSlot: 1, mySnapTurns: [4], theirSnapTurns: [] })), "acct-me");
    expect(far.ok && far.game).toMatchObject({ snapped: true, opponentSnapped: false });
  });

  it("reports no account at all when nothing in the file names the client", () => {
    // Who is local falls back to a deck-overlap guess, and that guess always answers 0 or 1,
    // so it is confidently wrong whenever it is wrong. Reading the account id off
    // players[guess] handed back the opponent's real account id, which the caller hashes to
    // file the game and to record the uploader's display name against. Both slots must come
    // back with nothing: the caller then hashes per tracker key, which cannot reach anybody
    // else's identity.
    for (const localSlot of [0, 1] as const) {
      const res = parseGameState(JSON.stringify(gameState({ localSlot, clientAccount: null })));
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.game.accountId).toBeNull();
      expect(res.game.playerName).toBe("Me");
    }
  });

  it("does not hand back the opponent's account when the guess is wrong", () => {
    // A turn-one retreat leaves nothing on the board, so the deck-overlap guess has no signal
    // and its tie goes to slot 0 while the uploader is in slot 1. The guess is simply wrong
    // here, and reading the account id off players[guess] returned the opponent's real account
    // id. The caller hashes that, so the game was filed under the opponent and a snap_names
    // row recorded the uploader's display name against the opponent's account: the site's only
    // rename evidence, feeding a merge that cannot be undone.
    const res = parseGameState(
      JSON.stringify(gameState({ localSlot: 1, clientAccount: null, emptyBoard: true })),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.game.accountId).not.toBe("acct-opp");
    expect(res.game.accountId).toBeNull();
    expect(res.game.playerName).toBe("Me");
  });

  it("takes the account from the one result entry carrying a deck", () => {
    // Only the local player's entry has a deck list, so when it names an account that is the
    // uploader, whatever the overlap guess would have said about the slots.
    const res = parseGameState(
      JSON.stringify(gameState({ localSlot: 1, clientAccount: null, itemAccount: "acct-me" })),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.game.accountId).toBe("acct-me");
  });

  it("keeps the board when the game doesn't name every location", () => {
    const res = parseGameState(
      JSON.stringify(gameState({ namedLocations: false, locationIds: ["Asgard", null] })),
      "acct-me",
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.game.board.map((z) => z.location)).toEqual(["Asgard", null, null]);
    expect(res.game.board[1].player).toEqual(["Thanos"]);
    expect(res.game.locations).toEqual(["Asgard"]);
  });

  it("reports games that haven't finished and half-written files", () => {
    expect(parseGameState(JSON.stringify(gameState({ withResult: false })))).toMatchObject({ ok: false, reason: "no-result" });
    expect(parseGameState('{"RemoteGame": {"GameState": {')).toMatchObject({ ok: false, reason: "invalid-json" });
  });
});
