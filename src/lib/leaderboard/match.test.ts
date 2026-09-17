import { describe, expect, it } from "vitest";
import { detectRenames, matchEntries } from "./match";

describe("matchEntries", () => {
  it("matches unique names directly", () => {
    const ids = matchEntries(
      [
        { rank: 1, name: "Sizer", score: 10050 },
        { rank: 2, name: "Newcomer", score: 9000 },
      ],
      [{ playerId: 7, name: "Sizer", score: 9990 }],
    );
    expect(ids).toEqual([7, null]);
  });

  it("keeps players who share a name apart by closest score, even when they swap order", () => {
    const known = [
      { playerId: 1, name: "Ghost", score: 9400 },
      { playerId: 2, name: "Ghost", score: 8100 },
    ];
    // The lower Ghost climbed a little, the higher one dropped a little: pairing stays stable.
    const ids = matchEntries(
      [
        { rank: 10, name: "Ghost", score: 9350 },
        { rank: 300, name: "Ghost", score: 8160 },
      ],
      known,
    );
    expect(ids).toEqual([1, 2]);
  });

  it("leaves a third player with a shared name unmatched", () => {
    const ids = matchEntries(
      [
        { rank: 1, name: "G", score: 9000 },
        { rank: 2, name: "G", score: 8500 },
        { rank: 3, name: "G", score: 7800 },
      ],
      [
        { playerId: 1, name: "G", score: 9010 },
        { playerId: 2, name: "G", score: 7790 },
      ],
    );
    expect(ids).toEqual([1, null, 2]);
  });

  it("is case and whitespace sensitive, like the API", () => {
    const ids = matchEntries([{ rank: 1, name: "Butt   ", score: 1 }], [{ playerId: 3, name: "Butt", score: 1 }]);
    expect(ids).toEqual([null]);
  });
});

describe("detectRenames", () => {
  const gone = (playerId: number, name: string, score: number, rank = 90) => ({ playerId, name, score, rank });
  const came = (index: number, name: string, score: number, rank = 80) => ({ index, name, score, rank });

  it("pairs a departure and an arrival holding the same score", () => {
    expect(detectRenames([gone(7, "PXL D. Rick", 4200)], [came(3, "PXL Rick", 4200)])).toEqual([
      { index: 3, playerId: 7, from: "PXL D. Rick", to: "PXL Rick" },
    ]);
  });

  it("leaves it alone when the score moved, rather than guessing", () => {
    expect(detectRenames([gone(7, "PXL D. Rick", 4200)], [came(3, "PXL Rick", 4207)])).toEqual([]);
  });

  it("refuses to guess when two departures share a score", () => {
    expect(detectRenames([gone(7, "A", 4200), gone(8, "B", 4200)], [came(3, "C", 4200)])).toEqual([]);
  });

  it("refuses to guess when two arrivals share a score", () => {
    expect(detectRenames([gone(7, "A", 4200)], [came(3, "B", 4200), came(4, "C", 4200)])).toEqual([]);
  });

  it("ignores a departure and arrival that are simply the same name", () => {
    expect(detectRenames([gone(7, "Ghost", 4200)], [came(3, "Ghost", 4200)])).toEqual([]);
  });

  it("handles several unrelated renames in one tick", () => {
    const result = detectRenames(
      [gone(7, "Old One", 4200), gone(9, "Old Two", 3100)],
      [came(1, "New Two", 3100), came(2, "New One", 4200)],
    );
    expect(result.map((r) => `${r.from}->${r.to}`).sort()).toEqual(["Old One->New One", "Old Two->New Two"]);
  });

  it("finds nothing in a quiet tick", () => {
    expect(detectRenames([], [])).toEqual([]);
    expect(detectRenames([gone(7, "A", 4200)], [])).toEqual([]);
  });
});
