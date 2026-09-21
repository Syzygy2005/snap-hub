import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { getCards } from "@/lib/cards/queries";
import { entries, history, syncState } from "./queries";
import { parseReference, syncReference } from "./sync";
const card = (i: number) => ({carddefid: `Wiki${i}`, name: `Hero ${i}`, type: "Character", status: "released", cost: 2, power: 3, ability: "<span>On Reveal</span>: Draw a card.", art: "https://example.com/art.webp", source: "Series 1", tags: [{tag:"Draw"}]});
const baseline = () => Array.from({length: 120},(_,i) => card(i));
const feed = (cards: unknown[]) => new Response(JSON.stringify({success:{cards}}), {headers:{"Last-Modified":"Mon, 21 Sep 2026 12:00:00 GMT"}});
beforeEach(async () => { const db = await getDb(); await db.query("truncate reference_changes, reference_sync, cards, locations"); });
afterEach(() => vi.unstubAllGlobals());
describe("automatic reference imports", () => {
  it("shares changed stats with builder/wiki and records only meaningful history after baseline", async () => {
    const rows = baseline(); const fetcher = vi.fn().mockImplementation(() => Promise.resolve(feed(rows)));
    vi.stubGlobal("fetch",fetcher);
    await syncReference("cards");
    expect(await history("cards","Wiki0")).toHaveLength(0);
    const first = await syncState("cards");
    await syncReference("cards");
    expect((await syncState("cards"))?.changed_at).toEqual(first?.changed_at);
    rows[0] = {...rows[0],name:"Renamed hero",cost:4,power:8,ability:"New effect"};
    rows.push(card(120));
    await syncReference("cards");
    const builder = (await getCards({deckableOnly:true})).find(c => c.defId === "Wiki0");
    const wiki = (await entries("cards")).find(c => c.def_id === "Wiki0");
    expect(builder).toMatchObject({name:"Renamed hero",cost:4,power:8,ability:"New effect"});
    expect(wiki).toMatchObject({name:builder?.name,cost:builder?.cost,power:builder?.power,ability:builder?.ability});
    expect(await history("cards","Wiki0")).toMatchObject([{before_data:{cost:2,power:3},after_data:{cost:4,power:8}}]);
    expect(await history("cards","Wiki120")).toHaveLength(0);
    await syncReference("cards");
    expect(await history("cards","Wiki0")).toHaveLength(1);
  });
  it("retains last good data and success time for partial, malformed and failed feeds", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(feed(baseline()));vi.stubGlobal("fetch",fetcher);
    await syncReference("cards"); const success = (await syncState("cards"))?.succeeded_at;
    for (const invalid of [baseline().slice(1),baseline().map((c,i) => i ? c : {...c,power:"bad"}),[]]) {
      fetcher.mockResolvedValueOnce(feed(invalid));
      await expect(syncReference("cards")).rejects.toThrow();
      expect(await getCards()).toHaveLength(120);
      expect((await syncState("cards"))?.succeeded_at).toEqual(success);
      expect((await syncState("cards"))?.error).toBeTruthy();
    }
    fetcher.mockResolvedValue(new Response("Unavailable",{status:503}));
    await expect(syncReference("cards")).rejects.toThrow("503");
    expect(await getCards()).toHaveLength(120);
  });
  it("accepts unchanged conditional responses and keeps unreleased cards out of builder", async () => {
    const rows = baseline(); rows[0].status="unreleased";
    const fetcher=vi.fn().mockResolvedValueOnce(feed(rows)).mockResolvedValueOnce(new Response(null,{status:304}));vi.stubGlobal("fetch",fetcher);
    await syncReference("cards"); const changed=(await syncState("cards"))?.changed_at;
    await syncReference("cards");
    expect(fetcher.mock.calls[1][1].headers["If-Modified-Since"]).toBeTruthy();
    expect((await syncState("cards"))?.changed_at).toEqual(changed);
    expect((await getCards({deckableOnly:true})).some(c=>c.defId==="Wiki0")).toBe(false);
  });
  it("allows unreleased placeholders to disappear but rejects a suspicious release-status collapse", async () => {
    const rows = baseline(); rows[0].status = "unreleased";
    const fetcher = vi.fn().mockResolvedValueOnce(feed(rows)); vi.stubGlobal("fetch",fetcher);
    await syncReference("cards");
    fetcher.mockResolvedValueOnce(feed(rows.slice(1)));
    await expect(syncReference("cards")).resolves.toMatchObject({total:119});
    fetcher.mockResolvedValueOnce(feed(rows.slice(1).map(r=>({...r,status:"unreleased"}))));
    await expect(syncReference("cards")).rejects.toThrow("Suspicious drop");
    expect(await getCards({deckableOnly:true})).toHaveLength(119);
  });
  it("imports location effects and rejects duplicate identifiers", async () => {
    const rows=Array.from({length:60},(_,i)=>({...card(i),type:"Location",rarity:"rare"}));
    vi.stubGlobal("fetch",vi.fn().mockImplementation(()=>Promise.resolve(feed(rows))));
    await syncReference("locations"); rows[0].ability="New location effect"; await syncReference("locations");
    expect((await entries("locations"))[0]).toMatchObject({rarity:"rare",ability:"New location effect"});
    expect(await history("locations","Wiki0")).toHaveLength(1);
    expect(()=>parseReference({success:{cards:[...rows,rows[0]]}},"locations")).toThrow("duplicate");
    expect(parseReference({success:{cards:[...rows,{...rows[0],carddefid:"",cid:342}]}},"locations").at(-1)?.def_id).toBe("SnapZoneLocation_342");
  });
});
