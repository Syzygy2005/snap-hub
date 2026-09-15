import { describe, expect, it } from "vitest";
import { cardStats, clusterDecks, deckKey, summarize, type GameForStats } from "./aggregate";

const deck = (prefix: string, swaps: string[] = []) => {
  const base = Array.from({ length: 12 }, (_, i) => `${prefix}${i + 1}`);
  return [...base.slice(0, 12 - swaps.length), ...swaps];
};
const game = (cards: string[], result: GameForStats["result"], cubes: number, extra: Partial<GameForStats> = {}): GameForStats => ({
  deckCards: cards,
  result,
  cubes,
  cardsDrawn: [],
  cardsPlayed: [],
  ...extra,
});

describe("summarize", () => {
  it("leaves ties out of win rate but counts them in cube rate", () => {
    const s = summarize([
      { result: "win", cubes: 8 },
      { result: "loss", cubes: -2 },
      { result: "tie", cubes: 0 },
      { result: "win", cubes: 2 },
    ]);
    expect(s).toEqual({ games: 4, wins: 2, losses: 1, ties: 1, winRate: 2 / 3, cubeRate: 2, netCubes: 8 });
    expect(summarize([]).winRate).toBeNull();
  });
});

describe("clusterDecks", () => {
  it("groups close variants into one archetype and names it by its distinctive cards", () => {
    const destroyA = deck("D");
    const destroyB = deck("D", ["X1", "X2"]); // 10 of 12 shared
    const discard = deck("S");
    const games = [
      game(destroyA, "win", 4),
      game(destroyA, "win", 2),
      game(destroyB, "loss", -1),
      game(discard, "loss", -8),
    ];
    const archetypes = clusterDecks(games, { cost: (c) => Number(c.replace(/\D/g, "")) });
    expect(archetypes).toHaveLength(2);

    const [top, other] = archetypes;
    expect(top.games).toBe(3);
    expect(top.metaShare).toBeCloseTo(0.75);
    expect(top.winRate).toBeCloseTo(2 / 3);
    expect(top.lists.map((l) => l.games)).toEqual([2, 1]);
    // D1-D10 are in every Destroy game (D11/D12 only in one version); cost breaks the tie.
    expect(top.signature).toEqual(["D10", "D9"]);
    expect(top.coreCards).toContain("D1");
    expect(top.coreCards).not.toContain("X1");
    expect(other.signature).toHaveLength(2);
    expect(deckKey(["b", "a", "b"])).toBe("a,b");
  });
});

describe("cardStats", () => {
  it("tracks in-deck, drawn and played win rates", () => {
    const cards = deck("C");
    const games = [
      game(cards, "win", 2, { cardsDrawn: ["C1"], cardsPlayed: ["C1"] }),
      game(cards, "loss", -4, { cardsDrawn: ["C1", "C2"], cardsPlayed: ["C2", "NotInDeck"] }),
      game(deck("Z"), "win", 1),
    ];
    const byId = new Map(cardStats(games).map((s) => [s.defId, s]));
    expect(byId.get("C1")).toMatchObject({ games: 2, winRate: 0.5, cubeRate: -1, drawnGames: 2, drawnWinRate: 0.5, playedGames: 1, playedWinRate: 1 });
    expect(byId.get("C2")).toMatchObject({ drawnGames: 1, drawnWinRate: 0, playedGames: 1 });
    expect(byId.get("C1")?.playRate).toBeCloseTo(2 / 3);
    expect(byId.has("NotInDeck")).toBe(false);
  });
});
