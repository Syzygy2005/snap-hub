import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { getCards } from "@/lib/cards/queries";
import { cardVariants, entries, history, syncState } from "./queries";
import { parseReference, pause, syncReference } from "./sync";
const card = (i: number) => ({carddefid: `Wiki${i}`, name: `Hero ${i}`, type: "Character", status: "released", cost: 2, power: 3, ability: "<span>On Reveal</span>: Draw a card.", art: "https://example.com/art.webp", source: "Series 1", tags: [{tag:"Draw"}], variants: []});
const variant = {cid:101,vid:4831,art:"https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/101_166025444242.webp?v=1090",variant_order:"01",status:"Released",rarity:"Rare",sketcher:"G-Angle",inker:"",colorist:"G-Angle",ReleaseDate:1651950000,CollectorsQualityDefId:""};
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
  it("backfills existing cards and refreshes variant catalogs without inventing balance changes", async () => {
    const rows = baseline().map((c,i) => ({...c,cid:101+i,variants:i === 0 ? [variant] : []}));
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(feed(rows)));
    vi.stubGlobal("fetch",fetcher);
    await syncReference("cards");
    expect(await cardVariants("Wiki0")).toMatchObject([{id:"4831",status:"released",artists:[{role:"Sketch",name:"G-Angle"},{role:"Color",name:"G-Angle"}]}]);
    const db = await getDb();
    await db.query("update cards set variants=null");
    await syncReference("cards");
    expect(fetcher.mock.calls[1][1].headers["If-Modified-Since"]).toBeUndefined();
    expect(await cardVariants("Wiki0")).toHaveLength(1);
    rows[0].variants.push({...variant,vid:4832,status:"Unreleased"});
    await syncReference("cards");
    expect(fetcher.mock.calls[2][1].headers["If-Modified-Since"]).toBeTruthy();
    expect(await cardVariants("Wiki0")).toHaveLength(2);
    expect(await history("cards","Wiki0")).toHaveLength(0);
    const unchanged = (await syncState("cards"))?.changed_at;
    await syncReference("cards");
    expect((await syncState("cards"))?.changed_at).toEqual(unchanged);
    fetcher.mockResolvedValueOnce(feed(rows.map(r => ({...r,variants:[]}))));
    await expect(syncReference("cards")).rejects.toThrow("variant catalog");
    expect(await cardVariants("Wiki0")).toHaveLength(2);
    const missing = rows.map((r,i) => i ? r : {...r,variants:undefined});
    fetcher.mockResolvedValueOnce(feed(missing));
    await expect(syncReference("cards")).rejects.toThrow("variant list");
    expect(await cardVariants("Wiki0")).toHaveLength(2);
    rows[0].variants[0] = {...variant,art:"javascript:alert(1)"};
    await expect(syncReference("cards")).rejects.toThrow();
    expect(await cardVariants("Wiki0")).toHaveLength(2);
    expect((await getCards()).find(c=>c.defId==="Wiki0")?.power).toBe(3);
  });
  it("keeps a delisted card's variants and still imports the rest of the feed", async () => {
    // Ten cards carry variants, so one of them losing its own is not a catalog-wide collapse.
    // This used to throw, and the rollback discarded every other card's names, costs, power and
    // ability text with it. Because the rollback also reverted last_modified, the next run
    // re-fetched the same body and threw again: one delisted variant froze card data for good.
    const rows = baseline().map((c,i) => ({...c, cid: 101+i, variants: i < 10 ? [{...variant, cid: 101+i, vid: 4831+i}] : []}));
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(feed(rows)));
    vi.stubGlobal("fetch",fetcher);
    await syncReference("cards");
    expect(await cardVariants("Wiki0")).toHaveLength(1);
    const unchanged = (await syncState("cards"))?.changed_at;

    fetcher.mockResolvedValueOnce(feed(rows.map((r,i) => i === 0 ? {...r, variants: [], name: "Renamed hero"} : r)));
    await expect(syncReference("cards")).resolves.toMatchObject({total:120});
    // The delisted card keeps what was already saved for it...
    expect(await cardVariants("Wiki0")).toHaveLength(1);
    // ...its other fields still updated, which the throw used to discard along with the import...
    expect((await entries("cards")).find(c => c.def_id === "Wiki0")?.name).toBe("Renamed hero");
    // ...and nothing is left flagged, so the next run is not refusing the same body again.
    expect((await syncState("cards"))?.error).toBeFalsy();
    // Retaining is not a change to the variant catalog, so it must not look like one.
    expect((await syncState("cards"))?.changed_at).not.toEqual(unchanged);

    // A catalog-wide collapse is still refused, measured on what actually arrived.
    fetcher.mockResolvedValueOnce(feed(rows.map(r => ({...r, variants: []}))));
    await expect(syncReference("cards")).rejects.toThrow("variant catalog");
    expect(await cardVariants("Wiki0")).toHaveLength(1);
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
  it("asks once more after a pause when the source refuses, and reports a second refusal", async () => {
    // The live source refused the locations feed with a 403 on nine of 67 hourly runs.
    const wait = vi.spyOn(pause, "wait").mockResolvedValue();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("Forbidden",{status:403})).mockResolvedValueOnce(feed(baseline()));
    vi.stubGlobal("fetch",fetcher);
    await expect(syncReference("cards")).resolves.toMatchObject({ total: 120 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
    fetcher.mockReset().mockResolvedValue(new Response("Forbidden",{status:403}));
    await expect(syncReference("cards")).rejects.toThrow("Reference source returned HTTP 403");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await getCards()).toHaveLength(120);
    wait.mockRestore();
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
    expect(await history("locations","Wiki0")).toMatchObject([{ before_data: { ability: "<span>On Reveal</span>: Draw a card." }, after_data: { ability: "New location effect" } }]);
    expect(()=>parseReference({success:{cards:[...rows,rows[0]]}},"locations")).toThrow("duplicate");
    expect(parseReference({success:{cards:[...rows,{...rows[0],carddefid:"",cid:342}]}},"locations").at(-1)?.def_id).toBe("SnapZoneLocation_342");
  });
});
