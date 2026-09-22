import { afterEach, describe, expect, it, vi } from "vitest";
import { toPgParam } from "@/lib/db";
import { getCards } from "./queries";
import { cleanAbility, isDeckable } from "./sync";
import { syncReference } from "@/lib/wiki/sync";
import { getDeck, listDecks, saveDeck } from "@/lib/decks/queries";

const card = (i: number, extra: Record<string, unknown> = {}) => ({
  name: `Hero ${i}`,
  type: "Character",
  cost: i % 7,
  power: i,
  ability: `<span>On Reveal</span>: Do thing ${i} with "quotes" \\ and <b>bold</b>.`,
  art: `https://example.com/${i}.webp`,
  status: "released",
  carddefid: `Hero${i}`,
  source: "Series 1",
  tags: [{ tag: "On Reveal" }, { tag: 'Odd "tag"' }],
  variants: [],
  ...extra,
});

afterEach(() => vi.unstubAllGlobals());

describe("card helpers", () => {
  it("keeps keyword spans and strips other markup", () => {
    expect(cleanAbility("<span>Ongoing</span>: <i>+1</i> Power&nbsp;here")).toBe("<span>Ongoing</span>: +1 Power here");
  });

  it("filters alternate-mode cards", () => {
    const base = { status: "released", source: "None" };
    expect(isDeckable({ ...base, name: "Thor Champion", carddefid: "ThorChampion" })).toBe(false);
    expect(isDeckable({ ...base, name: "Hulk - Avengers", carddefid: "HulkAvengers" })).toBe(false);
    expect(isDeckable({ ...base, name: "CaptainAmericaAvengers", carddefid: "CaptainAmericaAvengers" })).toBe(false);
    expect(isDeckable({ ...base, name: "Mephisto", carddefid: "Mephisto" })).toBe(false);
    expect(isDeckable({ ...base, name: "Toad", carddefid: "Toad" })).toBe(true);
  });

  it("serializes array params as Postgres literals", () => {
    expect(toPgParam([true, false, null])).toBe("{t,f,NULL}");
    expect(toPgParam(['a"b', "c\\d"])).toBe('{"a\\"b","c\\\\d"}');
    expect(toPgParam(5)).toBe(5);
  });
});

describe("card import + decks", () => {
  it("stores cards and saves, dedupes and lists decks", async () => {
    const payload = {
      success: {
        cards: [
          ...Array.from({ length: 120 }, (_, i) => card(i + 1)),
          card(999, { name: "Thor Champion", carddefid: "ThorChampion", source: "None" }),
        ],
      },
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload))));

    await expect(syncReference("cards")).resolves.toEqual({ total: 121, deckable: 120 });
    // Running twice updates in place.
    await syncReference("cards");

    const cards = await getCards({ deckableOnly: true });
    expect(cards).toHaveLength(120);
    const hero = cards.find((c) => c.defId === "Hero3")!;
    expect(hero.tags).toEqual(["On Reveal", 'Odd "tag"']);
    expect(hero.ability).toContain('"quotes" \\ and bold');

    const ids = cards.slice(0, 12).map((c) => c.defId);
    const first = await saveDeck({ name: "Test deck", cards: ids });
    expect(first.ok).toBe(true);
    const again = await saveDeck({ name: "Test deck", cards: [...ids].reverse() });
    expect(again).toEqual(first);

    expect(await saveDeck({ name: "Short", cards: ids.slice(0, 11) })).toMatchObject({ ok: false });
    expect(await saveDeck({ name: "Alt", cards: [...ids.slice(0, 11), "ThorChampion"] })).toMatchObject({ ok: false });

    const id = (first as { id: string }).id;
    expect((await getDeck(id, true))?.views).toBe(1);
    expect((await listDecks()).map((d) => d.id)).toContain(id);
  });
});
