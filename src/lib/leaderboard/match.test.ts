import { describe, expect, it } from "vitest";
import { matchEntries } from "./match";

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
