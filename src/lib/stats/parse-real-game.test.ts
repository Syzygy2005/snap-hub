import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseGameState } from "./parse-game";

/**
 * The first real GameState.json this project has seen, anonymised: every GUID swapped for a
 * stable fake and the three display names replaced. Nothing else was touched, byte-order mark
 * included, because a real file carries one and the parser has to cope with that.
 *
 * Everything before this was synthetic and agreed with itself. It did not agree with the game:
 * the board was read from `_to`, which does not exist, so the final board came back empty on
 * every upload and the fallback that works out which player is which never had anything to
 * work with.
 */

const FIXTURE = "src/lib/stats/fixtures/real-game.json";
const text = readFileSync(FIXTURE, "utf8");
const parse = (accountId?: string) => {
  const result = parseGameState(text, accountId);
  if (!result.ok) throw new Error(`fixture did not parse: ${result.reason} ${result.detail ?? ""}`);
  return result.game;
};

describe("a real finished game", () => {
  it("still carries a byte-order mark, and parses anyway", () => {
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(parse().gameId).toBeTruthy();
  });

  it("reads the game off the result message", () => {
    const g = parse();
    expect(g).toMatchObject({
      league: "RankedInfinite",
      result: "tie",
      cubes: 0,
      finalCubeValue: 4,
      battleMode: false,
      friendly: false,
      conceded: false,
      turns: 6,
      totalTurns: 6,
      deckName: "Shadowlands",
    });
    expect(g.deckCards).toHaveLength(12);
    expect(g.locations).toEqual(["Xandar", "Nidavellir", "CaveOfTheDragon"]);
  });

  it("reads the uploader's own name, which is what a rename is seen through", () => {
    expect(parse().playerName).toBe("LOCAL_PLAYER");
  });

  it("knows which player is the uploader without being told", () => {
    // The file names its own client, so no X-Snap-Account-Id header is needed. Before this,
    // a missing header reported the uploader as their own opponent.
    expect(parse().opponentName).toBe("OPPONENT");
    expect(parse("1105e9c9-d183-9f67-6073-8e62d3142ca1").opponentName).toBe("OPPONENT");
    // An account id that matches nobody falls back to the file rather than guessing players[0].
    expect(parse("nobody-at-all").opponentName).toBe("OPPONENT");
  });

  it("gives the board back per location, with the two sides split by card owner", () => {
    const g = parse();
    expect(g.board.map((z) => z.location)).toEqual(["Xandar", "Nidavellir", "CaveOfTheDragon"]);
    expect(g.board.every((z) => z.player.length > 0 && z.opponent.length > 0)).toBe(true);

    // The split is checked against something the parser did not use to make it: the deck comes
    // from the result message, so cards from it landing on the player's side, and none of them
    // on the opponent's, says the sides are the right way round.
    const mine = g.board.flatMap((z) => z.player);
    const theirs = g.board.flatMap((z) => z.opponent);
    expect(mine.filter((c) => g.deckCards.includes(c)).length).toBeGreaterThan(3);
    expect(theirs.filter((c) => g.deckCards.includes(c))).toEqual([]);
  });

  it("collects the opponent's revealed cards, which used to come back empty", () => {
    const g = parse();
    expect(g.opponentCards.length).toBeGreaterThan(0);
    expect(g.opponentCards).toEqual(expect.arrayContaining(["GrandMaster", "InfinityUltron"]));
    expect(g.opponentCards.filter((c) => g.deckCards.includes(c))).toEqual([]);
  });

  it("records what the uploader drew and played, from their own client info", () => {
    const g = parse();
    expect(g.cardsPlayed).toEqual(expect.arrayContaining(["ThanosFracturedFrontier", "Juggernaut"]));
    expect(g.cardsDrawn.length).toBeGreaterThan(0);
  });
});
