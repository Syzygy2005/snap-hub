import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { syncCards } from "@/lib/cards/sync";
import { likePattern, listDecks, saveDeck } from "./queries";

const card = (i: number) => ({
  name: `Hero ${i}`,
  type: "Character",
  cost: i % 7,
  power: i,
  ability: "",
  art: `https://example.com/${i}.webp`,
  status: "released",
  carddefid: `Hero${i}`,
  source: "Series 1",
  tags: [],
  variants: [],
});

const ids = (from: number) => Array.from({ length: 12 }, (_, i) => `Hero${from + i}`);

beforeAll(async () => {
  const payload = { success: { cards: Array.from({ length: 120 }, (_, i) => card(i + 1)) } };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload))));
  await syncCards();
  vi.unstubAllGlobals();

  await saveDeck({ name: "Ongoing pile", cards: ids(1) });
  await saveDeck({ name: "Move shell", cards: ids(13) });
  await saveDeck({ name: "100% Destroy", cards: ids(25) });
});

afterEach(() => vi.unstubAllGlobals());

const names = async (opts: Parameters<typeof listDecks>[0]) => (await listDecks(opts)).map((d) => d.name).sort();

describe("likePattern", () => {
  it("escapes the wildcards so they match themselves", () => {
    expect(likePattern("50%")).toBe("%50\\%%");
    expect(likePattern("a_b")).toBe("%a\\_b%");
    expect(likePattern("plain")).toBe("%plain%");
  });
});

describe("listDecks", () => {
  it("returns every deck when nothing is filtered", async () => {
    expect(await names({})).toEqual(["100% Destroy", "Move shell", "Ongoing pile"]);
  });

  it("matches on the deck name", async () => {
    expect(await names({ q: "shell" })).toEqual(["Move shell"]);
    expect(await names({ q: "SHELL" })).toEqual(["Move shell"]);
  });

  it("matches on the name of a card in the deck", async () => {
    expect(await names({ q: "Hero 13" })).toEqual(["Move shell"]);
    expect(await names({ q: "Hero 25" })).toEqual(["100% Destroy"]);
  });

  it("treats a percent sign in the search as a literal, not a wildcard", async () => {
    expect(await names({ q: "%" })).toEqual(["100% Destroy"]);
  });

  it("returns nothing when the search matches no name and no card", async () => {
    expect(await names({ q: "Galactus" })).toEqual([]);
  });

  it("keeps only decks containing every filtered card", async () => {
    expect(await names({ cards: ["Hero1"] })).toEqual(["Ongoing pile"]);
    expect(await names({ cards: ["Hero1", "Hero12"] })).toEqual(["Ongoing pile"]);
    expect(await names({ cards: ["Hero1", "Hero13"] })).toEqual([]);
  });

  it("applies the search and the card filter together", async () => {
    expect(await names({ q: "shell", cards: ["Hero13"] })).toEqual(["Move shell"]);
    expect(await names({ q: "pile", cards: ["Hero13"] })).toEqual([]);
  });

  it("honours limit", async () => {
    expect(await listDecks({ limit: 1 })).toHaveLength(1);
  });
});
