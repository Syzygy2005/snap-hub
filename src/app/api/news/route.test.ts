import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, type Db } from "@/lib/db";
import type { Account } from "@/lib/auth/session";

/**
 * The admin check lives in the route handler, not the UI, so it is worth proving that a
 * request that never touches the page is turned away. Only the cookie read is stubbed;
 * isAdmin runs for real against ADMIN_DISCORD_IDS.
 */

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  currentAccount: vi.fn(),
}));

const { currentAccount } = await import("@/lib/auth/session");
const { POST } = await import("./route");
const { PATCH, DELETE } = await import("./[id]/route");
const { listNews, createNews } = await import("@/lib/news/queries");

const signedIn = vi.mocked(currentAccount);
const account = (discordId: string, id = 1): Account => ({ id, discordId, username: "Noah", avatar: null });

const post = (body: unknown) =>
  POST(new Request("https://snap-hub.app/api/news", { method: "POST", body: JSON.stringify(body) }));
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

const item = {
  kind: "balance",
  title: "Iron Man changed",
  body: "5/0 -> 5/1.",
  sourceUrl: "https://marvelsnap.com/news/example",
  publishedAt: "2026-09-16T17:00:00Z",
};

let db: Db;
beforeEach(async () => {
  db = await getDb();
  await db.query(`delete from news`);
  await db.query(`delete from accounts`);
  await db.query(`insert into accounts (id, discord_id, username) values (1, '111', 'Noah')`);
  vi.stubEnv("ADMIN_DISCORD_IDS", "111");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("posting news", () => {
  it("turns away a signed-out visitor", async () => {
    signedIn.mockResolvedValue(null);
    expect((await post(item)).status).toBe(403);
    expect(await listNews()).toHaveLength(0);
  });

  it("turns away someone signed in who is not an admin", async () => {
    signedIn.mockResolvedValue(account("999"));
    expect((await post(item)).status).toBe(403);
    expect(await listNews()).toHaveLength(0);
  });

  it("turns everyone away when nobody is named as an admin", async () => {
    vi.stubEnv("ADMIN_DISCORD_IDS", "");
    signedIn.mockResolvedValue(account("111"));
    expect((await post(item)).status).toBe(403);
  });

  it("lets an admin post, and keeps their byline", async () => {
    signedIn.mockResolvedValue(account("111"));
    const res = await post(item);
    expect(res.status).toBe(200);
    const [stored] = await listNews();
    expect(stored).toMatchObject({ title: "Iron Man changed", author: "Noah" });
  });

  it("answers 400 rather than storing a bad link", async () => {
    signedIn.mockResolvedValue(account("111"));
    expect((await post({ ...item, sourceUrl: "javascript:alert(1)" })).status).toBe(400);
    expect(await listNews()).toHaveLength(0);
  });

  it("answers 400 on a body that is not JSON", async () => {
    signedIn.mockResolvedValue(account("111"));
    const res = await POST(new Request("https://snap-hub.app/api/news", { method: "POST", body: "{" }));
    expect(res.status).toBe(400);
  });
});

describe("editing and deleting news", () => {
  it("turns away everyone but an admin", async () => {
    signedIn.mockResolvedValue(account("111"));
    const created = await createNews(item, 1);
    if (!created.ok) throw new Error("setup failed");
    const id = String(created.item.id);

    for (const who of [null, account("999")]) {
      signedIn.mockResolvedValue(who);
      const edit = new Request("https://snap-hub.app/x", { method: "PATCH", body: JSON.stringify(item) });
      expect((await PATCH(edit, ctx(id))).status).toBe(403);
      expect((await DELETE(new Request("https://snap-hub.app/x"), ctx(id))).status).toBe(403);
    }
    expect(await listNews()).toHaveLength(1);
  });

  it("answers 404 for an id that is not a number or not there", async () => {
    signedIn.mockResolvedValue(account("111"));
    for (const id of ["abc", "0", "-1", "9999"]) {
      expect((await DELETE(new Request("https://snap-hub.app/x"), ctx(id))).status).toBe(404);
    }
  });

  it("lets an admin edit and delete", async () => {
    signedIn.mockResolvedValue(account("111"));
    const created = await createNews(item, 1);
    if (!created.ok) throw new Error("setup failed");
    const id = String(created.item.id);

    const edit = new Request("https://snap-hub.app/x", {
      method: "PATCH",
      body: JSON.stringify({ ...item, title: "Corrected" }),
    });
    expect((await PATCH(edit, ctx(id))).status).toBe(200);
    expect((await listNews())[0].title).toBe("Corrected");

    expect((await DELETE(new Request("https://snap-hub.app/x"), ctx(id))).status).toBe(200);
    expect(await listNews()).toHaveLength(0);
  });
});
