import { describe, expect, it } from "vitest";
import { locationRecords } from "./aggregate";

const lane = (location: string | null, won?: boolean, powerPlayed?: number | null) => ({
  location,
  ...(won === undefined ? {} : { won }),
  ...(powerPlayed === undefined ? {} : { powerPlayed }),
});

describe("locationRecords", () => {
  it("counts lanes won per location and averages the power committed", () => {
    const records = locationRecords([
      [lane("Kyln", true, 10), lane("Limbo", false, 4)],
      [lane("Kyln", false, 6), lane("Limbo", true, 8)],
      [lane("Kyln", true, 20)],
    ]);
    expect(records).toEqual([
      { location: "Kyln", games: 3, won: 2, winRate: 2 / 3, power: 12 },
      { location: "Limbo", games: 2, won: 1, winRate: 0.5, power: 6 },
    ]);
  });

  it("skips lanes whose result was never recorded rather than calling them losses", () => {
    // A board stored before lane results were read has no `won` at all. Treating that as a loss
    // would drag every rate down for as long as the old games stayed in the window.
    const records = locationRecords([
      [lane("Kyln", true, 10)],
      [lane("Kyln")], // recorded before, no result
      [lane("Kyln", undefined, 5)], // power but still no result
    ]);
    expect(records).toEqual([{ location: "Kyln", games: 1, won: 1, winRate: 1, power: 10 }]);
  });

  it("ignores a lane nobody saw, which has no location to count", () => {
    // A retreat on turn one leaves two locations unrevealed, and those come through as null.
    expect(locationRecords([[lane(null, false), lane("Kyln", true, 3)]])).toEqual([
      { location: "Kyln", games: 1, won: 1, winRate: 1, power: 3 },
    ]);
  });

  it("averages power over the lanes that had any, not over every lane", () => {
    // Playing nothing at a location is not zero power, it is no measurement.
    const [kyln] = locationRecords([[lane("Kyln", false, null)], [lane("Kyln", true, 9)]]);
    expect(kyln).toMatchObject({ games: 2, won: 1, power: 9 });
  });

  it("has nothing to say about no games", () => {
    expect(locationRecords([])).toEqual([]);
  });
});
