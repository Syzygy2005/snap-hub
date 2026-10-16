import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { currentAccount } from "@/lib/auth/session";
import { getDeck, listDecks, saveDeck } from "@/lib/decks/queries";
import { DELETE, PATCH } from "./route";

vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn() }));
const owner = { id: 9401, discordId: "deck-owner", username: "Owner", avatar: null };
const other = { id: 9402, discordId: "deck-other", username: "Other", avatar: null };
const admin = { id: 9403, discordId: "deck-admin", username: "Admin", avatar: null };
const cards = Array.from({ length: 12 }, (_, i) => `OwnCard${i}`);

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const remove = (id: string) => DELETE(new Request(`http://localhost/api/decks/${id}`, { method: "DELETE" }), params(id));
const patch = (id: string, body: unknown) => PATCH(
  new Request(`http://localhost/api/decks/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  params(id),
);
const as = (account: typeof owner | null) => vi.mocked(currentAccount).mockResolvedValue(account);
const share = async (name: string, listed: boolean, by: number | null) =>
  ((await saveDeck({ name, cards, listed }, by)) as { ok: true; id: string }).id;

beforeAll(async () => {
  const db = await getDb();
  await db.query(`insert into accounts (id, discord_id, username) values
    (9401, 'deck-owner', 'Owner'), (9402, 'deck-other', 'Other'), (9403, 'deck-admin', 'Admin') on conflict do nothing`);
  for (const id of cards) {
    await db.query(`insert into cards (def_id, name, cost, power, ability, art, series, deckable)
      values ($1, $1, 1, 1, '', '', '', true) on conflict do nothing`, [id]);
  }
});
beforeEach(() => {
  as(null);
  vi.stubEnv("ADMIN_DISCORD_IDS", admin.discordId);
});
afterEach(() => vi.unstubAllEnvs());

describe("the owner of a shared deck", () => {
  it("can take it off the Decks page and put it back, keeping the link", async () => {
    const id = await share("Owner toggles", true, owner.id);
    as(owner);
    expect(await (await patch(id, { listed: false })).json()).toMatchObject({ ok: true, listed: false });
    expect(await getDeck(id)).toMatchObject({ listed: false });
    expect((await listDecks()).map((d) => d.id)).not.toContain(id);
    expect(await (await patch(id, { listed: true })).json()).toMatchObject({ ok: true, listed: true });
    expect((await listDecks()).map((d) => d.id)).toContain(id);
  });

  it("can delete it, after which the link finds nothing", async () => {
    const id = await share("Owner deletes", false, owner.id);
    as(owner);
    const res = await remove(id);
    expect(res.status).toBe(200);
    expect(await getDeck(id)).toBeNull();
  });

  it("is told when an identical copy already has the other visibility, and both copies stay", async () => {
    // The dedupe key includes visibility, so a public and an unlisted copy of the same name and
    // cards can both exist; making one look like the other would collide on the unique index.
    const publicCopy = await share("Twin", true, owner.id);
    const unlistedCopy = await share("Twin", false, owner.id);
    as(owner);
    const res = await patch(publicCopy, { listed: false });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already have an unlisted copy/);
    expect(await getDeck(publicCopy)).toMatchObject({ listed: true });
    expect(await getDeck(unlistedCopy)).toMatchObject({ listed: false });
  });
});

describe("anyone else", () => {
  it("must sign in first", async () => {
    const id = await share("Signed-out attempt", true, owner.id);
    expect((await remove(id)).status).toBe(401);
    expect((await patch(id, { listed: false })).status).toBe(401);
    expect(await getDeck(id)).toMatchObject({ listed: true });
  });

  it("cannot change or delete a deck another account shared", async () => {
    const id = await share("Not yours", true, owner.id);
    as(other);
    expect((await remove(id)).status).toBe(403);
    expect((await patch(id, { listed: false })).status).toBe(403);
    expect(await getDeck(id)).toMatchObject({ listed: true });
  });

  it("cannot claim a deck shared while signed out, which only an admin can remove", async () => {
    const id = await share("Nobody's deck", false, null);
    as(other);
    expect((await remove(id)).status).toBe(403);
    expect(await getDeck(id)).not.toBeNull();
    as(admin);
    expect((await remove(id)).status).toBe(200);
  });

  it("cannot rename a deck, which stays admin moderation", async () => {
    const id = await share("Keep this name", true, owner.id);
    as(owner);
    expect((await patch(id, { name: "Owner rename" })).status).toBe(403);
    as(admin);
    expect(await (await patch(id, { name: "Admin rename" })).json()).toMatchObject({ ok: true });
    expect(await getDeck(id)).toMatchObject({ name: "Admin rename" });
  });

  it("gets a 404 for a deck that does not exist", async () => {
    as(owner);
    expect((await remove("no-such-deck")).status).toBe(404);
    expect((await patch("no-such-deck", { listed: false })).status).toBe(404);
  });
});

describe("an admin", () => {
  it("can still unlist and delete any shared deck", async () => {
    const id = await share("Moderated", true, owner.id);
    as(admin);
    expect(await (await patch(id, { listed: false })).json()).toMatchObject({ ok: true, listed: false });
    expect((await remove(id)).status).toBe(200);
  });
});
