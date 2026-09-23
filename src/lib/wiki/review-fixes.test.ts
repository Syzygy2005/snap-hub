import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { mentions, related } from "@/components/wiki-discovery";
import { errorMessage } from "@/components/variant-tools";
import { artists, browseVariants } from "./variant-browser";
import { clampPage } from "./filter";
import { WIKI_CRUMBS, WIKI_SECTIONS } from "./sections";
import type { CardVariant } from "./variants";

const art = (id: string, status: "released" | "unreleased", name: string): CardVariant => ({
  id, art: "/brand/emblem.svg", order: id, status, rarity: "Rare",
  artists: [{ role: "Sketch", name }], releaseDate: null, collectorQuality: null,
});

beforeAll(async () => {
  const db = await getDb();
  await db.query(`insert into cards(def_id,name,cost,power,ability,art,series,deckable,variants) values
    ('RfMover','Rf Mover',2,2,'<span>On Reveal</span>: Move this card.','','1',true,$1::text::jsonb),
    ('RfRemover','Rf Remover',2,2,'<span>On Reveal</span>: Remove a card from play.','','1',true,$2::text::jsonb),
    ('RfDrawer','Rf Drawer',2,2,'Draws you a card.','','1',true,'[]'::jsonb)
    on conflict (def_id) do nothing`,
    [JSON.stringify([art("m1", "released", "Rf Released Artist"), art("m2", "released", "Rf Released Artist")]),
     JSON.stringify([art("r1", "unreleased", "Rf Preview Only")])]);
});

describe("Keep exploring matches words, not letters inside them", () => {
  it("does not read 'remove' as a Move card", () => {
    expect(mentions("<span>On Reveal</span>: Remove a card from play.")).not.toContain("move");
    expect(mentions("<span>On Reveal</span>: Move this card.")).toContain("move");
    expect(mentions("When this moves, gain +2 Power.")).toContain("move");
  });

  it("does not read 'withdraw' as Draw", () => {
    expect(mentions("Withdraw from a location.")).not.toContain("draw");
    expect(mentions("Draw a card.")).toContain("draw");
  });

  it("reaches the Bounce and Zoo guides, which the keyword list could never match", () => {
    expect(mentions("Return this card to your hand.")).toContain("return");
    expect(mentions("Your 1-Cost cards have +1 Power.")).toContain("1-cost");
  });

  it("applies the same word rule in the database query", async () => {
    const ids = (await related("RfNobody", ["move"])).map((r) => r.def_id);
    expect(ids).toContain("RfMover");
    expect(ids).not.toContain("RfRemover");
    const drawers = (await related("RfNobody", ["draw"])).map((r) => r.def_id);
    expect(drawers).toContain("RfDrawer");
  });
});

describe("artists asks for only what the caller needs", () => {
  it("fetches one artist exactly by name", async () => {
    const [one, ...rest] = await artists({ name: "Rf Preview Only" });
    expect(rest).toEqual([]);
    expect(one).toMatchObject({ name: "Rf Preview Only", total: 1, released: 0 });
  });

  it("caps the rows, and a seed gives the same pick every time", async () => {
    expect(await artists({ limit: 1 })).toHaveLength(1);
    const first = await artists({ seed: "2026-09-23", limit: 1 });
    const again = await artists({ seed: "2026-09-23", limit: 1 });
    expect(first).toHaveLength(1);
    expect(again[0].name).toBe(first[0].name);
  });

  it("still filters by a search term", async () => {
    expect((await artists({ q: "rf released" })).map((a) => a.name)).toEqual(["Rf Released Artist"]);
  });
});

describe("site search skips the variant total it never shows", () => {
  it("returns the first rows without counting the catalog", async () => {
    const result = await browseVariants({ artist: "Rf Released Artist" }, 1, { count: false });
    expect(result.items).toHaveLength(1);
    expect(result).toMatchObject({ page: 1, pages: 1 });
  });
});

describe("clampPage", () => {
  it("keeps a requested page inside the pages that exist", () => {
    expect(clampPage("", 100, 36)).toEqual({ page: 1, pages: 3 });
    expect(clampPage("2", 100, 36)).toEqual({ page: 2, pages: 3 });
    expect(clampPage("999", 100, 36)).toEqual({ page: 3, pages: 3 });
    expect(clampPage("0", 100, 36)).toEqual({ page: 1, pages: 3 });
    expect(clampPage("-4", 100, 36)).toEqual({ page: 1, pages: 3 });
    expect(clampPage("abc", 100, 36)).toEqual({ page: 1, pages: 3 });
    expect(clampPage("2.9", 100, 36)).toEqual({ page: 2, pages: 3 });
    expect(clampPage("5", 0, 36)).toEqual({ page: 1, pages: 1 });
  });
});

describe("errorMessage", () => {
  it("falls back cleanly when the error body is an HTML page", async () => {
    // A proxy 502 or Next's error page is HTML. Parsing it used to put
    // "Unexpected token '<'" in front of the user.
    const html = new Response("<!DOCTYPE html><html>Bad gateway</html>", { status: 502 });
    expect(await errorMessage(html, "Couldn't save variant.")).toBe("Couldn't save variant.");
  });

  it("uses the server's message when there is one", async () => {
    const json = Response.json({ error: "Sign in to save variants." }, { status: 401 });
    expect(await errorMessage(json, "fallback")).toBe("Sign in to save variants.");
  });
});

describe("the wiki section list", () => {
  it("no longer carries the interaction lab", () => {
    expect(WIKI_SECTIONS.map((s) => s.href)).not.toContain("/wiki/interactions");
    expect(WIKI_CRUMBS.interactions).toBeUndefined();
  });

  it("gives every section a breadcrumb, and keeps the private collection out of the sitemap set", () => {
    for (const s of WIKI_SECTIONS.filter((s) => s.href !== "/wiki")) {
      expect(WIKI_CRUMBS[s.href.split("/").pop()!]).toBeTruthy();
    }
    expect(WIKI_SECTIONS.find((s) => s.href === "/wiki/my-collection")?.private).toBe(true);
    expect(WIKI_CRUMBS.collection).toBe("Collection guide");
  });
});
