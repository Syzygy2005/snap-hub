import { beforeEach, describe, expect, it } from "vitest";
import { getDb, type Db } from "@/lib/db";
import { cleanSourceUrl, createNews, deleteNews, latestNews, listNews, updateNews } from "./queries";

let db: Db;
let author: number;
beforeEach(async () => {
  db = await getDb();
  await db.query(`delete from news`);
  await db.query(`delete from accounts`);
  const [a] = await db.query<{ id: number }>(
    `insert into accounts (discord_id, username) values ('1', 'Noah') returning id`,
  );
  author = a.id;
});

const good = {
  kind: "balance",
  title: "Iron Man and Onslaught changed",
  body: "Iron Man 5/0 -> 5/1.\nOnslaught 6/7 -> 6/6.",
  sourceUrl: "https://marvelsnap.com/news/example",
  publishedAt: "2026-09-16T17:00:00Z",
};

describe("cleanSourceUrl", () => {
  it("keeps http and https", () => {
    expect(cleanSourceUrl("https://marvelsnap.com/x")).toEqual({ ok: true, url: "https://marvelsnap.com/x" });
    expect(cleanSourceUrl("http://marvelsnap.com/x")).toEqual({ ok: true, url: "http://marvelsnap.com/x" });
  });

  it("treats nothing as no link rather than an error", () => {
    for (const empty of ["", "   ", null, undefined]) expect(cleanSourceUrl(empty)).toEqual({ ok: true, url: null });
  });

  it("refuses anything that is not a plain web address", () => {
    // The admin is trusted to be careful, not infallible: a bad paste must not become an href.
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "vbscript:x", "not a url", "/news", 7]) {
      expect(cleanSourceUrl(bad).ok).toBe(false);
    }
  });
});

describe("news items", () => {
  it("stores one and reads it back with its byline", async () => {
    const result = await createNews(good, author);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item).toMatchObject({
      kind: "balance",
      title: "Iron Man and Onslaught changed",
      sourceUrl: "https://marvelsnap.com/news/example",
      author: "Noah",
    });
    expect(result.item.publishedAt).toBe("2026-09-16T17:00:00.000Z");
    expect(await listNews()).toHaveLength(1);
  });

  it("orders by when the change happened, not when it was typed up", async () => {
    await createNews({ ...good, title: "Older", publishedAt: "2026-09-01T00:00:00Z" }, author);
    await createNews({ ...good, title: "Newer", publishedAt: "2026-09-20T00:00:00Z" }, author);
    await createNews({ ...good, title: "Middle", publishedAt: "2026-09-10T00:00:00Z" }, author);
    expect((await listNews()).map((n) => n.title)).toEqual(["Newer", "Middle", "Older"]);
    expect((await latestNews())?.title).toBe("Newer");
  });

  it("refuses the things a hurried post gets wrong", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ ...good, kind: "rumour" }, "kind"],
      [{ ...good, title: "  " }, "title"],
      [{ ...good, body: "" }, "body"],
      [{ ...good, sourceUrl: "javascript:alert(1)" }, "link"],
      [{ ...good, publishedAt: "the fourteenth" }, "date"],
      [{ ...good, title: "x".repeat(121) }, "long title"],
    ];
    for (const [input, what] of cases) {
      const result = await createNews(input, author);
      expect([what, result.ok]).toEqual([what, false]);
    }
    expect(await listNews()).toHaveLength(0);
  });

  it("defaults the date to now when none is given", async () => {
    const before = Date.now();
    const result = await createNews({ ...good, publishedAt: "" }, author);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Date(result.item.publishedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("edits and deletes, and says so when the id is not there", async () => {
    const created = await createNews(good, author);
    if (!created.ok) throw new Error("setup failed");

    const edited = await updateNews(created.item.id, { ...good, title: "Corrected", kind: "patch" });
    expect(edited).toMatchObject({ ok: true, item: { title: "Corrected", kind: "patch" } });
    expect(await updateNews(9999, good)).toBeNull();

    // A rejected edit leaves the stored item alone.
    await updateNews(created.item.id, { ...good, title: "" });
    expect((await listNews())[0].title).toBe("Corrected");

    expect(await deleteNews(created.item.id)).toBe(true);
    expect(await deleteNews(created.item.id)).toBe(false);
    expect(await listNews()).toHaveLength(0);
  });

  it("keeps an item when its author's account goes", async () => {
    await createNews(good, author);
    await db.query(`delete from accounts where id = $1`, [author]);
    const [item] = await listNews();
    expect(item.title).toBe(good.title);
    expect(item.author).toBeNull();
  });
});
