import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { currentAccount } from "@/lib/auth/session";
import { getDeck, listDecks } from "@/lib/decks/queries";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn() }));
const account = { id: 9101, discordId: "public-gate", username: "Lister", avatar: null };
const cards = Array.from({ length: 12 }, (_, i) => `PubGate${i}`);
const post = (body: unknown) => POST(new Request("http://localhost/api/decks", { method: "POST", body: JSON.stringify(body) }));

beforeAll(async () => {
  const db = await getDb();
  await db.query("insert into accounts (id, discord_id, username) values (9101, 'public-gate', 'Lister') on conflict do nothing");
  for (const id of cards) {
    await db.query(`insert into cards (def_id, name, cost, power, ability, art, series, deckable)
      values ($1, $1, 1, 1, '', '', '', true) on conflict do nothing`, [id]);
  }
});
beforeEach(() => vi.mocked(currentAccount).mockResolvedValue(null));

it("keeps signed-out decks off the Decks page, which anyone could otherwise flood", async () => {
  const refused = await post({ name: "Spam 1", cards });
  expect(refused.status).toBe(401);
  expect((await refused.json()).error).toContain("share it unlisted");
  expect((await post({ name: "Spam 2", cards, listed: true })).status).toBe(401);
  expect((await listDecks()).some((d) => d.name.startsWith("Spam"))).toBe(false);
});

it("still shares a signed-out deck by link, unlisted", async () => {
  const res = await post({ name: "Link only", cards, listed: false });
  expect(res.status).toBe(200);
  const { id } = await res.json();
  expect(await getDeck(id)).toMatchObject({ name: "Link only", listed: false });
});

it("lists a signed-in deck under the account", async () => {
  vi.mocked(currentAccount).mockResolvedValue(account);
  const res = await post({ name: "Public brew", cards });
  expect(res.status).toBe(200);
  const { id } = await res.json();
  expect(await getDeck(id)).toMatchObject({ listed: true, owner: "Lister" });
});
