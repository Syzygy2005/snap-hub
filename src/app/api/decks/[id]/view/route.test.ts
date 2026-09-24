import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { currentAccount } from "@/lib/auth/session";
import { getDeck, saveDeck } from "@/lib/decks/queries";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn() }));
const owner = { id: 9301, discordId: "view-owner", username: "Owner", avatar: null };
const visitor = { id: 9302, discordId: "view-visitor", username: "Visitor", avatar: null };
const cards = Array.from({ length: 12 }, (_, i) => `ViewCard${i}`);
let owned = "";
let anonymous = "";

const view = (id: string, origin?: string) => POST(
  new Request(`http://localhost/api/decks/${id}/view`, { method: "POST", headers: origin ? { origin } : {} }),
  { params: Promise.resolve({ id }) },
);
const views = async (id: string) => (await getDeck(id))!.views;

beforeAll(async () => {
  const db = await getDb();
  await db.query("insert into accounts (id, discord_id, username) values (9301, 'view-owner', 'Owner'), (9302, 'view-visitor', 'Visitor') on conflict do nothing");
  for (const id of cards) {
    await db.query(`insert into cards (def_id, name, cost, power, ability, art, series, deckable)
      values ($1, $1, 1, 1, '', '', '', true) on conflict do nothing`, [id]);
  }
  owned = ((await saveDeck({ name: "Owned", cards }, owner.id)) as { id: string }).id;
  anonymous = ((await saveDeck({ name: "Nobody's", cards, listed: false }, null)) as { id: string }).id;
});
beforeEach(() => vi.mocked(currentAccount).mockResolvedValue(null));

it("counts a signed-out view of a signed-out deck", async () => {
  // The case a plain "owner is distinct from viewer" gets wrong: null against null is not distinct.
  const before = await views(anonymous);
  expect(await (await view(anonymous)).json()).toMatchObject({ counted: true });
  expect(await views(anonymous)).toBe(before + 1);
});

it("counts a visitor but never the owner looking at their own deck", async () => {
  const before = await views(owned);
  vi.mocked(currentAccount).mockResolvedValue(owner);
  expect(await (await view(owned)).json()).toMatchObject({ counted: false });
  vi.mocked(currentAccount).mockResolvedValue(visitor);
  expect(await (await view(owned)).json()).toMatchObject({ counted: true });
  expect(await views(owned)).toBe(before + 1);
});

it("refuses a count posted from another site", async () => {
  const before = await views(owned);
  expect((await view(owned, "https://evil.test")).status).toBe(403);
  expect(await views(owned)).toBe(before);
});

it("counts nothing for a deck that does not exist", async () => {
  expect(await (await view("no-such-deck")).json()).toMatchObject({ counted: false });
});
