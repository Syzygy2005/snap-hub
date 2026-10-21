import { describe, expect, it } from "vitest";
import { MAX_WATCHED, parseWatchlist, sameRecord, toggleWatched, unwatch, type Watched } from "./watchlist";

const saved: Watched = { id: 412, name: "Rogue Main", firstSeen: "2026-09-20T10:00:00.000Z" };

describe("sameRecord", () => {
  it("follows a player through a rename, which keeps the record", () => {
    expect(sameRecord(saved, { id: 412, name: "Rogue Main TTV", firstSeen: saved.firstSeen })).toBe(true);
  });

  it("follows the kept record through a merge, which only moves its first sighting earlier", () => {
    expect(sameRecord(saved, { id: 412, name: "Rogue Main", firstSeen: "2026-09-18T00:00:00.000Z" })).toBe(true);
  });

  it("refuses a record created after the watch, which is what a reset puts behind an old id", () => {
    // reset-leaderboard.sql restarts the ids, so 412 comes back as somebody first seen later.
    expect(sameRecord(saved, { id: 412, name: "Rogue Main", firstSeen: "2026-11-01T00:05:00.000Z" })).toBe(false);
  });
});

describe("parseWatchlist", () => {
  it("reads nothing from missing, broken or foreign storage", () => {
    for (const raw of [null, "", "not json", "{}", "42", '"x"']) expect(parseWatchlist(raw)).toEqual([]);
  });

  it("keeps good entries and drops junk and repeats", () => {
    const raw = JSON.stringify([
      saved,
      { ...saved, name: "again" },
      { id: -1, name: "x", firstSeen: saved.firstSeen },
      { id: 7, name: "no date" },
      { id: 8, name: "bad date", firstSeen: "soon" },
      { id: 9, name: 9, firstSeen: saved.firstSeen },
      { id: 10, name: "Ten", firstSeen: saved.firstSeen, extra: "dropped" },
    ]);
    expect(parseWatchlist(raw)).toEqual([saved, { id: 10, name: "Ten", firstSeen: saved.firstSeen }]);
  });

  it("never reads more than the cap, whatever was written", () => {
    const many = Array.from({ length: MAX_WATCHED + 5 }, (_, i) => ({ id: i + 1, name: `P${i}`, firstSeen: saved.firstSeen }));
    expect(parseWatchlist(JSON.stringify(many))).toHaveLength(MAX_WATCHED);
  });
});

describe("toggleWatched", () => {
  const player = { id: 412, name: "Rogue Main", firstSeen: saved.firstSeen };

  it("adds a player and removes them again", () => {
    const once = toggleWatched([], player);
    expect(once).toEqual([saved]);
    expect(toggleWatched(once, player)).toEqual([]);
  });

  it("replaces a stale entry for the same id instead of keeping both", () => {
    const reborn = { id: 412, name: "Someone Else", firstSeen: "2026-11-01T00:05:00.000Z" };
    expect(toggleWatched([saved], reborn)).toEqual([reborn]);
  });

  it("adds nobody once the list is full", () => {
    const full = Array.from({ length: MAX_WATCHED }, (_, i) => ({ id: i + 1, name: `P${i}`, firstSeen: saved.firstSeen }));
    expect(toggleWatched(full, { id: 999, name: "One more", firstSeen: saved.firstSeen })).toBe(full);
  });

  it("unwatches by id", () => {
    expect(unwatch([saved, { ...saved, id: 5 }], 412)).toEqual([{ ...saved, id: 5 }]);
  });
});
