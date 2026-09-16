import { describe, expect, it } from "vitest";
import {
  parseDraft,
  parseLocalDecks,
  removeLocalDeck,
  sameCards,
  UNTITLED,
  upsertLocalDeck,
  type LocalDeck,
} from "./local";

const deck = (id: string, updatedAt: string, name = id): LocalDeck => ({
  id,
  name,
  cards: ["AntMan", "Thanos"],
  updatedAt,
});

describe("parseLocalDecks", () => {
  it("returns newest first", () => {
    const raw = JSON.stringify([deck("a", "2026-01-01T00:00:00.000Z"), deck("b", "2026-06-01T00:00:00.000Z")]);
    expect(parseLocalDecks(raw).map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("survives anything that isn't a deck list", () => {
    expect(parseLocalDecks(null)).toEqual([]);
    expect(parseLocalDecks("not json")).toEqual([]);
    expect(parseLocalDecks('{"deck":[]}')).toEqual([]);
  });

  it("drops entries missing an id or a usable card list, and duplicate ids", () => {
    const raw = JSON.stringify([
      deck("keep", "2026-01-01T00:00:00.000Z"),
      { name: "no id", cards: [], updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "bad-cards", name: "x", cards: [1, 2], updatedAt: "2026-01-01T00:00:00.000Z" },
      deck("keep", "2026-02-01T00:00:00.000Z", "second copy"),
    ]);
    expect(parseLocalDecks(raw).map((d) => d.id)).toEqual(["keep"]);
    expect(parseLocalDecks(raw)[0].name).toBe("keep");
  });

  it("falls back to a placeholder name and epoch date", () => {
    const raw = JSON.stringify([{ id: "a", name: "   ", cards: [] }]);
    expect(parseLocalDecks(raw)[0]).toEqual({
      id: "a",
      name: UNTITLED,
      cards: [],
      updatedAt: new Date(0).toISOString(),
    });
  });
});

describe("parseDraft", () => {
  it("reads a draft written before saved decks existed", () => {
    expect(parseDraft(JSON.stringify({ name: "Destroy", deck: ["AntMan"] }))).toEqual({
      name: "Destroy",
      deck: ["AntMan"],
      savedId: null,
    });
  });

  it("rejects a draft with no usable card list", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('{"name":"x"}')).toBeNull();
    expect(parseDraft('{"deck":[1]}')).toBeNull();
  });
});

describe("upsertLocalDeck", () => {
  it("replaces the deck with the same id rather than adding a second copy", () => {
    const decks = [deck("a", "2026-01-01T00:00:00.000Z"), deck("b", "2026-02-01T00:00:00.000Z")];
    const next = upsertLocalDeck(decks, { ...deck("a", "2026-03-01T00:00:00.000Z"), name: "renamed" });
    expect(next.map((d) => d.id)).toEqual(["a", "b"]);
    expect(next[0].name).toBe("renamed");
  });

  it("adds a deck with a new id", () => {
    expect(upsertLocalDeck([deck("a", "2026-01-01T00:00:00.000Z")], deck("c", "2026-02-01T00:00:00.000Z"))).toHaveLength(2);
  });
});

describe("removeLocalDeck", () => {
  it("removes only the named deck", () => {
    const decks = [deck("a", "2026-01-01T00:00:00.000Z"), deck("b", "2026-02-01T00:00:00.000Z")];
    expect(removeLocalDeck(decks, "a").map((d) => d.id)).toEqual(["b"]);
    expect(removeLocalDeck(decks, "missing")).toHaveLength(2);
  });
});

describe("sameCards", () => {
  it("compares order and length", () => {
    expect(sameCards(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameCards(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameCards(["a"], ["a", "b"])).toBe(false);
  });
});
