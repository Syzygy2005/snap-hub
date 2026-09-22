import { beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { browseVariants, variantFacets } from "./variant-browser";
import { pageHref } from "./filter";
import { searchSite } from "@/lib/search";
import { searchGuides, WIKI_GUIDES } from "./guides";
import type { CardVariant } from "./variants";

const variant = (id: string, extra: Partial<CardVariant> = {}): CardVariant => ({
  id, art:"/brand/emblem.svg",order:id,status:"released",rarity:"Rare",
  artists:[{role:"Sketch",name:"A & B"},{role:"Ink",name:"Ink Artist"},{role:"Color",name:"A & B"}],
  releaseDate:null,collectorQuality:null,...extra,
});
beforeAll(async()=>{
  const db = await getDb();
  await db.query("insert into cards(def_id,name,cost,power,ability,art,series,deckable,variants) values ('Discovery','Discovery Card',1,2,'<span>On Reveal</span>: Draw a card.','','1',true,$1::text::jsonb)", [JSON.stringify([
    ...Array.from({length:40},(_,i)=>variant(String(i))),
    variant("preview",{status:"unreleased",artists:[{role:"Color",name:"Preview Artist"}]}),
    variant("percent",{rarity:"100%_Rare",artists:[]}),
  ])]);
  await db.query("insert into cards(def_id,name,cost,power,ability,art,series,deckable,reference_status,variants) values ('Hidden','Discovery Secret',1,2,'','','1',false,'unreleased',$1::text::jsonb)",[JSON.stringify([variant("secret",{artists:[{role:"Sketch",name:"Hidden Artist"}]})])]);
  await db.query("insert into locations(def_id,name,ability,art,rarity,status) values ('Discovery','Discovery Location','Draw a card.','','common','released'),('Hidden','Discovery Secret','','','common','unreleased')");
  await db.query("insert into players(name) values ('Discovery Player')");
  await db.query("insert into decks(id,name,cards,card_key,listed) values ('public','Discovery Public','{}','p',true),('unlisted','Discovery Unlisted','{}','u',false)");
  await db.query("insert into accounts(discord_id,username) values ('discovery','Discovery Account')");
  await db.query("insert into account_decks(id,owner_id,name,cards) select 'draft',id,'Discovery Private','{}' from accounts where discord_id='discovery'");
});

describe("variant discovery",()=>{
  it("filters every credited role, deduplicates facets and keeps previews explicit",async()=>{
    expect((await browseVariants({artist:"ink artist"})).total).toBe(40);
    expect((await browseVariants({artist:"A & B"})).total).toBe(40);
    expect((await browseVariants({q:"preview"})).total).toBe(0);
    expect((await browseVariants({status:"unreleased",artist:"Preview Artist"})).total).toBe(1);
    expect(await variantFacets("released")).toEqual({artists:["A & B","Ink Artist"],rarities:["100%_Rare","Rare"]});
    expect((await browseVariants({q:"Secret",status:"unreleased"})).total).toBe(0);
  });
  it("paginates stable results, clamps invalid pages and preserves combined filters",async()=>{
    const first=await browseVariants({artist:"A & B",rarity:"Rare"});
    const last=await browseVariants({artist:"A & B",rarity:"Rare",page:"999"});
    expect(first).toMatchObject({total:40,page:1,pages:2});
    expect(first.items).toHaveLength(36);
    expect(last.items).toHaveLength(4);
    expect(last.page).toBe(2);
    expect(new Set([...first.items,...last.items].map(r=>r.variant.id)).size).toBe(40);
    expect((await browseVariants({page:"NaN"})).page).toBe(1);
    expect((await browseVariants({artist:["A & B","Unknown"]})).total).toBe(41);
    expect(pageHref("/wiki/variants",{artist:"A & B",rarity:"Rare",status:"released",card:"Discovery",q:"Card"},2)).toContain("artist=A+%26+B");
    expect((await browseVariants({q:"%_"})).items.map(r=>r.variant.id)).toEqual(["percent"]);
    expect((await browseVariants({card:"No such card"})).total).toBe(0);
  });
});

describe("site search",()=>{
  it("groups public results and excludes unreleased references and private/unlisted decks",async()=>{
    const groups=await searchSite("  Discovery  ");
    expect(groups.some(g=>g.unavailable)).toBe(false);
    expect(groups.find(g=>g.title==="Cards")?.items.map(i=>i.title)).toEqual(["Discovery Card"]);
    expect(groups.find(g=>g.title==="Locations")?.items.map(i=>i.title)).toEqual(["Discovery Location"]);
    expect(groups.find(g=>g.title==="Players")?.items.map(i=>i.title)).toEqual(["Discovery Player"]);
    expect(groups.find(g=>g.title==="Public decks")?.items.map(i=>i.title)).toEqual(["Discovery Public"]);
    expect(groups.find(g=>g.title==="Variants")).toMatchObject({more:"/wiki/variants?q=Discovery"});
    expect(groups.find(g=>g.title==="Variants")?.items).toHaveLength(8);
    expect(JSON.stringify(groups)).not.toMatch(/Secret|Unlisted|Private|preview/);
  });
  it("finds artists, plain-text abilities, guide aliases and literal special characters",async()=>{
    expect((await searchSite("A & B")).find(g=>g.title==="Variants")?.items.length).toBeGreaterThan(0);
    expect((await searchSite("On Reveal")).find(g=>g.title==="Cards")?.items[0]?.description).toBe("On Reveal: Draw a card.");
    expect((await searchSite("%_")).find(g=>g.title==="Variants")?.items).toHaveLength(1);
    expect(searchGuides("prio").some(g=>g.href==="/wiki/terminology#priority")).toBe(true);
    expect(await searchSite("   ")).toEqual([]);
    expect((await searchSite("NoMatchingStringAnywhere")).every(g=>!g.items.length && !g.unavailable)).toBe(true);
  });
  it("keeps other categories when one query fails and reports the missing category",async()=>{
    const db=await getDb();
    const original=db.query.bind(db);
    const spy=vi.spyOn(db,"query").mockImplementation((sql,args)=>{
      if(sql.includes("from locations where")) return Promise.reject(new Error("test outage"));
      return original(sql,args);
    });
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    try {
      const groups=await searchSite("Discovery");
      expect(groups.find(g=>g.title==="Locations")).toMatchObject({items:[],unavailable:true});
      expect(groups.find(g=>g.title==="Cards")?.items).toHaveLength(1);
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
  it("gives every guide search hit a valid section anchor",()=>{
    for(const guide of WIKI_GUIDES){
      expect(new Set(guide.sections.map(s=>s.id)).size).toBe(guide.sections.length);
      for(const section of guide.sections){
        expect(searchGuides(section.title).some(r=>r.href===`/wiki/${guide.slug}#${section.id}`)).toBe(true);
      }
    }
  });
});
