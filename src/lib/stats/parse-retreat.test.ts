import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseGameState } from "./parse-game";

/**
 * The second real GameState.json, anonymised the same way as real-game.json: all 35 GUIDs
 * swapped for stable fakes, the uploader, the opponent and the opponent's clan renamed, the
 * byte-order mark kept. The opponent's name keeps a curly apostrophe because the real one had
 * one. Confirmed to parse identically to the file it came from apart from those fields.
 *
 * real-game.json is a six-turn tie that ran to the end. This one is the opposite corner and
 * covers what that file cannot: a retreat on turn one, so nothing was ever played, the board is
 * empty at every location, two of the three locations were never revealed, and the uploader
 * sits in the second player slot behind a $ref.
 */

const FIXTURE = "src/lib/stats/fixtures/real-retreat.json";
const text = readFileSync(FIXTURE, "utf8");
const parse = (accountId?: string) => {
  const result = parseGameState(text, accountId);
  if (!result.ok) throw new Error(`fixture did not parse: ${result.reason} ${result.detail ?? ""}`);
  return result.game;
};

describe("a real turn-one retreat", () => {
  it("reads the retreat as a conceded loss of one cube", () => {
    // conceded had only ever been checked against a fixture written by hand.
    expect(parse()).toMatchObject({
      result: "loss",
      cubes: -1,
      finalCubeValue: 1,
      conceded: true,
      turns: 1,
      totalTurns: 6,
      league: "RankedInfinite",
      battleMode: false,
      friendly: false,
      snapped: false,
      opponentSnapped: false,
    });
  });

  it("drops the locations nobody ever saw", () => {
    // The second and third locations turn over on turns two and three, so a retreat on turn one
    // leaves the game reporting them as RevealOn2 and RevealOn3. They match nothing in the
    // locations table, so the site prettified the ID and showed "Reveal On 2" as though it were
    // a location, and stored both alongside the real one.
    const g = parse();
    expect(g.locations).toEqual(["TimeTheater"]);
    expect(g.board.map((z) => z.location)).toEqual(["TimeTheater", null, null]);
  });

  it("has nothing on the board, which is the whole point of retreating on one", () => {
    const g = parse();
    expect(g.board.every((z) => z.player.length === 0 && z.opponent.length === 0)).toBe(true);
    expect(g.opponentCards).toEqual([]);
    expect(g.cardsPlayed).toEqual([]);
    // The uploader still drew a hand, so an empty board is not an empty file.
    expect(g.cardsDrawn.length).toBeGreaterThan(0);
    expect(g.deckCards).toHaveLength(12);
  });

  it("knows the uploader from the file even though they are the second player", () => {
    const g = parse();
    expect(g.playerName).toBe("LOCAL_PLAYER");
    expect(g.opponentName).toBe("OPPONENT’2");
  });

  it("reports no account rather than the opponent's when nothing names the uploader", () => {
    // The real version of the case the guess exists for. With an empty board the deck-overlap
    // fallback has no signal at all, so it ties and answers slot 0, which here is the opponent.
    // The guess is genuinely wrong on this file: strip what names the client and opponentName
    // comes back as the uploader. What must not happen is an account ID being emitted from it,
    // because record-game hashes that to decide whose game this is.
    const blind = JSON.parse(text.slice(1));
    delete blind.RemoteGame.ClientPlayerInfo.AccountId;
    for (const item of blind.RemoteGame.GameState.ClientResultMessage.GameResultAccountItems) {
      delete item.AccountId;
    }
    const result = parseGameState(String.fromCharCode(0xfeff) + JSON.stringify(blind));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.opponentName).toBe("LOCAL_PLAYER");
    expect(result.game.accountId).toBeNull();
  });
});
