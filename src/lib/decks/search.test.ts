import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { syncCards } from "@/lib/cards/sync";
import { getDeck, likePattern, listDecks, saveDeck } from "./queries";

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

const idOf = (r: Awaited<ReturnType<typeof saveDeck>>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id;
};

describe("unlisted decks", () => {
  it("stays off the list but stays reachable by its link", async () => {
    const id = idOf(await saveDeck({ name: "Secret Brew", cards: ids(37), listed: false }));

    expect(await names({})).not.toContain("Secret Brew");
    expect(await names({ q: "Secret" })).toEqual([]);
    expect(await names({ q: "Hero 37" })).toEqual([]);
    expect(await names({ cards: ["Hero37"] })).toEqual([]);

    const fetched = await getDeck(id);
    expect(fetched?.name).toBe("Secret Brew");
    expect(fetched?.listed).toBe(false);
  });

  it("dedupes within one visibility but never across it", async () => {
    const hidden = idOf(await saveDeck({ name: "Same Name", cards: ids(49), listed: false }));
    expect(idOf(await saveDeck({ name: "Same Name", cards: ids(49), listed: false }))).toBe(hidden);

    // The old dedupe key would have handed this back the unlisted row and quietly published it.
    const shown = idOf(await saveDeck({ name: "Same Name", cards: ids(49) }));
    expect(shown).not.toBe(hidden);
    expect((await getDeck(hidden))?.listed).toBe(false);
    expect((await getDeck(shown))?.listed).toBe(true);
    expect(await names({ q: "Same Name" })).toEqual(["Same Name"]);
  });

  it("stays public when the caller says nothing", async () => {
    const id = idOf(await saveDeck({ name: "Old Client", cards: ids(61) }));
    expect((await getDeck(id))?.listed).toBe(true);
  });
});
