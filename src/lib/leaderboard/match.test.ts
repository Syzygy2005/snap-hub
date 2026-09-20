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
  /** The ordinary case: the old name has gone from the board and the new one is unheard of. */
  const clean = (departures: { name: string }[], arrivals: { name: string }[]) => ({
    onBoard: new Set(arrivals.map((a) => a.name)),
    known: new Set(departures.map((d) => d.name)),
    shared: new Set<string>(),
  });

  it("pairs a departure and an arrival holding the same score", () => {
    expect(detectRenames([gone(7, "PXL D. Rick", 4200)], [came(3, "PXL Rick", 4200)], clean([gone(7, "PXL D. Rick", 4200)], [came(3, "PXL Rick", 4200)]))).toEqual([
      { index: 3, playerId: 7, from: "PXL D. Rick", to: "PXL Rick" },
    ]);
  });

  it("leaves it alone when the score moved, rather than guessing", () => {
    expect(detectRenames([gone(7, "PXL D. Rick", 4200)], [came(3, "PXL Rick", 4207)], clean([gone(7, "PXL D. Rick", 4200)], [came(3, "PXL Rick", 4207)]))).toEqual([]);
  });

  it("refuses to guess when two departures share a score", () => {
    expect(detectRenames([gone(7, "A", 4200), gone(8, "B", 4200)], [came(3, "C", 4200)], clean([gone(7, "A", 4200), gone(8, "B", 4200)], [came(3, "C", 4200)]))).toEqual([]);
  });

  it("refuses to guess when two arrivals share a score", () => {
    expect(detectRenames([gone(7, "A", 4200)], [came(3, "B", 4200), came(4, "C", 4200)], clean([gone(7, "A", 4200)], [came(3, "B", 4200), came(4, "C", 4200)]))).toEqual([]);
  });

  it("ignores a departure and arrival that are simply the same name", () => {
    expect(detectRenames([gone(7, "Ghost", 4200)], [came(3, "Ghost", 4200)], clean([gone(7, "Ghost", 4200)], [came(3, "Ghost", 4200)]))).toEqual([]);
  });

  it("handles several unrelated renames in one tick", () => {
    const departures = [gone(7, "Old One", 4200), gone(9, "Old Two", 3100)];
    const arrivals = [came(1, "New Two", 3100), came(2, "New One", 4200)];
    const result = detectRenames(departures, arrivals, clean(departures, arrivals));
    expect(result.map((r) => `${r.from}->${r.to}`).sort()).toEqual(["Old One->New One", "Old Two->New Two"]);
  });

  it("finds nothing in a quiet tick", () => {
    expect(detectRenames([], [], clean([], []))).toEqual([]);
    expect(detectRenames([gone(7, "A", 4200)], [], clean([gone(7, "A", 4200)], []))).toEqual([]);
  });
});

describe("detectRenames and names the board still holds", () => {
  const gone = (playerId: number, name: string, score: number) => ({ playerId, name, score, rank: 900 });
  const came = (index: number, name: string, score: number) => ({ index, name, score, rank: 880 });

  it("ignores a departure whose name is still on the board", () => {
    // Dozens of players share a default name. matchEntries pairs those by closest score, and
    // when the count shifts one is left unclaimed: a pairing artifact, not somebody leaving.
    const departures = [gone(7, "PlayerName", 8598)];
    const arrivals = [came(3, "Somebody Real", 8598)];
    const names = {
      onBoard: new Set(["PlayerName", "Somebody Real", "Other"]),
      known: new Set(["PlayerName", "Other"]),
      shared: new Set<string>(),
    };
    expect(detectRenames(departures, arrivals, names)).toEqual([]);
  });

  it("still catches it once that name really has gone from the board", () => {
    const departures = [gone(7, "PlayerName", 8598)];
    const arrivals = [came(3, "Somebody Real", 8598)];
    const names = { onBoard: new Set(["Somebody Real", "Other"]), known: new Set(["PlayerName", "Other"]), shared: new Set<string>() };
    expect(detectRenames(departures, arrivals, names)).toEqual([
      { index: 3, playerId: 7, from: "PlayerName", to: "Somebody Real" },
    ]);
  });

  it("ignores a departure on a name more than one player has held, even once it has left the board", () => {
    // The case that was still getting through: a handful of players carry the default name
    // and they churn, so it leaves the board outright now and then. In that tick nothing on
    // the board says it was ever shared, which is why the season's history has to.
    const departures = [gone(7, "PlayerName", 8598)];
    const arrivals = [came(3, "Stranger", 8598)];
    const names = {
      onBoard: new Set(["Stranger", "Other"]),
      known: new Set(["PlayerName", "Other"]),
      shared: new Set(["PlayerName"]),
    };
    expect(detectRenames(departures, arrivals, names)).toEqual([]);
  });

  it("ignores an arrival onto a name more than one player has held", () => {
    const departures = [gone(7, "Departed", 8598)];
    const arrivals = [came(3, "PlayerName", 8598)];
    const names = {
      onBoard: new Set(["PlayerName"]),
      known: new Set(["Departed"]),
      shared: new Set(["PlayerName"]),
    };
    expect(detectRenames(departures, arrivals, names)).toEqual([]);
  });

  it("still catches a rename on a name only one player ever had", () => {
    const departures = [gone(7, "PXL D. Rick", 8598)];
    const arrivals = [came(3, "PXL Rick", 8598)];
    const names = {
      onBoard: new Set(["PXL Rick", "Other"]),
      known: new Set(["PXL D. Rick", "Other"]),
      shared: new Set(["PlayerName"]),
    };
    expect(detectRenames(departures, arrivals, names)).toEqual([
      { index: 3, playerId: 7, from: "PXL D. Rick", to: "PXL Rick" },
    ]);
  });

  it("ignores an arrival whose name is already tracked this season", () => {
    // A name reappearing belongs to the player who had it, not to whoever just left.
    const departures = [gone(7, "Departed", 8598)];
    const arrivals = [came(3, "Returning", 8598)];
    const names = { onBoard: new Set(["Returning"]), known: new Set(["Departed", "Returning"]), shared: new Set<string>() };
    expect(detectRenames(departures, arrivals, names)).toEqual([]);
  });
});
