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
  } = {},
) {
  const local = overrides.localSlot ?? 0;
  const me = {
    $id: "p-me",
    EntityId: 7,
    PlayerInfo: { $id: "pi-me", AccountId: "acct-me", Name: "Me" },
    _turnsOnStakesRaiseRequested: [],
  };
  const opp = {
    $id: "p-opp",
    EntityId: 2,
    PlayerInfo: { $id: "pi-opp", AccountId: "acct-opp", Name: "Rival#123" },
    _turnsOnStakesRaiseRequested: [5],
  };
  const players = local === 0 ? [me, opp] : [opp, me];
  const named = overrides.namedLocations ?? true;
  const mine = (card: Record<string, unknown>) => ({ ...card, Owner: { $ref: "p-me" } });
  const theirs = (card: Record<string, unknown>) => ({ ...card, Owner: { $ref: "p-opp" } });
  const location = (name: string, cards: unknown[]) => ({
    ...(named ? { LocationDefId: name } : {}),
    _cards: { $values: cards },
  });
  const clientAccount = overrides.clientAccount === undefined ? "acct-me" : overrides.clientAccount;

  return {
    RemoteGame: {
      $id: "1",
      ClientPlayerInfo: {
        ...(clientAccount === null ? {} : { AccountId: clientAccount }),
        Name: "Me",
        CardsDrawn: ["AntMan", "Thanos", "Wasp"],
        CardsPlayed: { $id: "cp", $values: [{ CardDefId: "AntMan" }, { $ref: "card-thanos" }] },
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
                    IsWinner: local === 0,
                    IsLoser: local !== 0,
                    Conceded: false,
                    _stakesRaised: true,
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
  const BOARD = [
    { location: "Asgard", player: ["AntMan"], opponent: ["Hulk"] },
    { location: "Wakanda", player: ["Thanos"], opponent: ["Sunspot"] },
    { location: "Xandar", player: [], opponent: [] },
  ];

  it("reads a win, following $ref pointers and $values arrays", () => {
    const res = parseGameState(withBom(gameState()), "acct-me");
    expect(res).toEqual({
      ok: true,
      game: {
        gameId: "game-abc",
        league: "Ranked",
        battleMode: false,
        friendly: false,
        result: "win",
        cubes: 4,
        finalCubeValue: 4,
        conceded: false,
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
