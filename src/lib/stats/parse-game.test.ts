import { describe, expect, it } from "vitest";
import { parseGameState } from "./parse-game";

// SYNTHETIC fixture shaped after the published tracker field map, not a real game file.
// When a real GameState.json is available, add it as a fixture and extend these tests.
function gameState(overrides: { localSlot?: 0 | 1; withResult?: boolean } = {}) {
  const local = overrides.localSlot ?? 0;
  const me = { $id: "p-me", PlayerInfo: { $id: "pi-me", AccountId: "acct-me", Name: "Me" }, _turnsOnStakesRaiseRequested: [] };
  const opp = {
    $id: "p-opp",
    PlayerInfo: { $id: "pi-opp", AccountId: "acct-opp", Name: "Rival#123" },
    _turnsOnStakesRaiseRequested: [5],
  };
  const players = local === 0 ? [me, opp] : [opp, me];
  const myCards = [{ CardDefId: "AntMan" }, { CardDefId: "Thanos" }];
  const oppCards = [{ CardDefId: "Hulk" }, { CardDefId: "Sunspot" }];
  const mySide = local === 0 ? "_player1Cards" : "_player2Cards";
  const oppSide = local === 0 ? "_player2Cards" : "_player1Cards";

  return {
    RemoteGame: {
      $id: "1",
      ClientPlayerInfo: {
        CardsDrawn: ["AntMan", "Thanos", "Wasp"],
        CardsPlayed: { $id: "cp", $values: [{ CardDefId: "AntMan" }, { $ref: "card-thanos" }] },
      },
      GameState: {
        $id: "2",
        _players: players.map((p) => ({ $ref: p.$id })),
        _allPlayers: players,
        _to: [
          { [mySide]: [myCards[0]], [oppSide]: [oppCards[0]] },
          { [mySide]: [{ $id: "card-thanos", CardDefId: "Thanos" }], [oppSide]: [oppCards[1]] },
          { [mySide]: [], [oppSide]: [] },
        ],
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
                LocationDefIdsAtEndOfGame: ["Asgard", "Wakanda", "Xandar"],
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
        opponentName: "Rival#123",
        opponentCards: ["Hulk", "Sunspot"],
        cardsDrawn: ["AntMan", "Thanos", "Wasp"],
        cardsPlayed: ["AntMan", "Thanos"],
        locations: ["Asgard", "Wakanda", "Xandar"],
      },
    });
  });

  it("works out which side is the player from their deck when no account ID is sent", () => {
    const res = parseGameState(JSON.stringify(gameState({ localSlot: 1 })));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.game.result).toBe("loss");
    expect(res.game.cubes).toBe(-4);
    expect(res.game.opponentName).toBe("Rival#123");
    expect(res.game.opponentCards).toEqual(["Hulk", "Sunspot"]);
  });

  it("reports games that haven't finished and half-written files", () => {
    expect(parseGameState(JSON.stringify(gameState({ withResult: false })))).toMatchObject({ ok: false, reason: "no-result" });
    expect(parseGameState('{"RemoteGame": {"GameState": {')).toMatchObject({ ok: false, reason: "invalid-json" });
  });
});
