import { beforeEach, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { currentAccount } from "@/lib/auth/session";
import { GET, POST, DELETE } from "./route";
import { getDeck, listDecks } from "@/lib/decks/queries";

vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn() }));
const owner = { id: 9001, discordId: "private-owner", username: "Owner", avatar: null };
const other = { ...owner, id: 9002, discordId: "private-other" };
beforeEach(async () => {
  const db = await getDb();
  await db.query("delete from account_decks");
  await db.query("insert into accounts (id, discord_id, username) values (9001, 'private-owner', 'Owner'), (9002, 'private-other', 'Other') on conflict do nothing");
  await db.query("insert into cards (def_id, name, cost, power, ability, art, series, deckable) values ('PrivateTest', 'Card', 1, 1, '', '', '', true) on conflict do nothing");
  vi.mocked(currentAccount).mockResolvedValue(owner);
});
const save = (body: unknown) => POST(new Request("http://localhost/api/decks/private", { method: "POST", body: JSON.stringify(body) }));

it("requires a session for reads, writes, and deletion", async () => {
  vi.mocked(currentAccount).mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect((await save({ cards: ["PrivateTest"] })).status).toBe(401);
  expect((await DELETE(new Request("http://localhost/api/decks/private?id=x"))).status).toBe(401);
});

it("keeps account drafts out of public reads and prevents cross-account access", async () => {
  const saved = await (await save({ name: "Secret", cards: ["PrivateTest"], ownerId: other.id })).json();
  const id = saved.deck.id;
  expect(id).toBeTruthy();
  expect(await getDeck(id)).toBeNull();
  expect((await listDecks()).some((d) => d.id === id)).toBe(false);
  expect((await GET()).headers.get("cache-control")).toContain("no-store");
  expect((await (await GET()).json()).decks).toHaveLength(1);
  vi.mocked(currentAccount).mockResolvedValue(other);
  expect((await (await GET()).json()).decks).toEqual([]);
  expect((await save({ id, name: "Stolen", cards: ["PrivateTest"] })).status).toBe(404);
  expect((await DELETE(new Request(`http://localhost/api/decks/private?id=${id}`))).status).toBe(404);
  vi.mocked(currentAccount).mockResolvedValue(owner);
  expect((await save({ id, name: "Updated", cards: ["PrivateTest"] })).status).toBe(200);
  expect((await (await GET()).json()).decks[0].name).toBe("Updated");
  expect((await DELETE(new Request(`http://localhost/api/decks/private?id=${id}`))).status).toBe(200);
  expect((await (await GET()).json()).decks).toEqual([]);
});

it("rejects unknown cards and invalid payloads", async () => {
  for (const body of [null, [], { cards: [] }, { cards: ["Unknown"] }, { cards: [1] }]) expect((await save(body)).status).toBe(400);
});
