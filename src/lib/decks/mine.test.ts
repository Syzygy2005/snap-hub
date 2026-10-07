import { beforeEach, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { getAccountDeck, saveAccountDeck } from "./account";
import { getDeck, listDecks, ownedDecks, saveDeck } from "./queries";

const owner = 9701;
const other = 9702;
const cards = Array.from({ length: 12 }, (_, i) => `MineCard${i + 1}`);

beforeEach(async () => {
  const db = await getDb();
  await db.query("insert into accounts(id, discord_id, username) values (9701, 'mine-owner', 'Mine owner'), (9702, 'mine-other', 'Someone else') on conflict do nothing");
  await db.query("delete from account_decks where owner_id in (9701, 9702)");
  await db.query("delete from decks where owner_id in (9701, 9702)");
  for (const id of cards) await db.query(
    "insert into cards(def_id, name, cost, power, ability, art, series, deckable) values ($1, $1, 1, 1, '', '', '1', true) on conflict do nothing", [id],
  );
});

it("a private draft link resolves only for its session owner", async () => {
  const saved = await saveAccountDeck(owner, { name: "Private plan", cards: cards.slice(0, 2) });
  if (!saved.ok) throw new Error(saved.error);
  expect(await getAccountDeck(owner, saved.deck.id)).toEqual(saved.deck);
  expect(await getAccountDeck(other, saved.deck.id)).toBeNull();
  expect(await getAccountDeck(owner, "missing")).toBeNull();
  expect(await getDeck(saved.deck.id)).toBeNull();
});

it("My decks includes the owner's public and unlisted copies without exposing anyone else's", async () => {
  await saveDeck({ name: "Mine public", cards }, owner);
  await saveDeck({ name: "Mine unlisted", cards, listed: false }, owner);
  await saveDeck({ name: "Someone else's secret", cards, listed: false }, other);
  await saveDeck({ name: "Someone else's public", cards }, other);
  await saveAccountDeck(owner, { name: "Private plan", cards });
  const result = await ownedDecks(owner);
  expect(result.total).toBe(2);
  expect(result.decks.map((d) => d.name).sort()).toEqual(["Mine public", "Mine unlisted"]);
  expect(result.decks.find((d) => d.name === "Mine unlisted")?.listed).toBe(false);
  expect((await listDecks()).some((d) => d.name === "Mine unlisted")).toBe(false);
});

it("editing a reopened account draft retains its ID and leaves shared copies unchanged", async () => {
  const draft = await saveAccountDeck(owner, { name: "Original draft", cards });
  const shared = await saveDeck({ name: "Original shared copy", cards, listed: false }, owner);
  if (!draft.ok || !shared.ok) throw new Error("Fixture save failed");
  const changed = await saveAccountDeck(owner, { id: draft.deck.id, name: "Updated draft", cards: cards.slice(0, 4) });
  expect(changed.ok && changed.deck.id).toBe(draft.deck.id);
  expect((await getAccountDeck(owner, draft.deck.id))?.name).toBe("Updated draft");
  expect(await getDeck(shared.id)).toMatchObject({ name: "Original shared copy", cards, listed: false });
});

it("pages all owned shared copies with stable, nonoverlapping results", async () => {
  for (let i = 0; i < 25; i++) await saveDeck({ name: `Page deck ${i}`, cards, listed: i % 2 === 0 }, owner);
  const first = await ownedDecks(owner);
  const last = await ownedDecks(owner, 99);
  expect(first).toMatchObject({ total: 25, page: 1, pages: 2 });
  expect(first.decks).toHaveLength(24);
  expect(last.page).toBe(2);
  expect(last.decks).toHaveLength(1);
  expect(first.decks.map((d) => d.id)).not.toContain(last.decks[0].id);
  expect((await ownedDecks(owner, Number.NaN)).page).toBe(1);
});
