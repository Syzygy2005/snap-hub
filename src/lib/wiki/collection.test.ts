import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { currentAccount } from "@/lib/auth/session";
import { GET,PUT } from "@/app/api/collection/route";
import { POST,DELETE } from "@/app/api/collection/share/route";
import { collection,enableShare,disableShare,shareToken,sharedWishlist } from "./collection";
import { artists,findVariant } from "./variant-browser";
import { parseVariantKey,variantKey } from "./variant-key";
import { sameOrigin } from "@/lib/http";
vi.mock("@/lib/auth/session",()=>({currentAccount:vi.fn()}));
const owner={id:9101,discordId:"collection-owner",username:"Collector",avatar:null},other={...owner,id:9102,discordId:"collection-other"};
const variant=(id:string,status="released")=>({id,status,art:"/brand/emblem.svg",order:null,rarity:"Rare",releaseDate:null,collectorQuality:null,artists:[{role:"Sketch",name:"Collection & Artist"},{role:"Color",name:"Collection & Artist"}]});
const catalog=JSON.stringify([variant("owned"),variant("wanted"),variant("preview","unreleased")]);
const save=(body:unknown,origin="http://localhost")=>PUT(new Request("http://localhost/api/collection",{method:"PUT",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(body)}));
const shareRequest=()=>new Request("http://localhost/api/collection/share",{method:"POST",headers:{Origin:"http://localhost"}});
beforeAll(async()=>{
  const db=await getDb();
  await db.query("insert into accounts(id,discord_id,username) values (9101,'collection-owner','Collector'),(9102,'collection-other','Other') on conflict do nothing");
  await db.query("insert into cards(def_id,name,cost,power,ability,art,series,deckable,variants) values('CollectionTest','Collection test',1,1,'','','1',true,$1::text::jsonb) on conflict(def_id) do update set variants=excluded.variants",[catalog]);
});
afterAll(async()=>{
  // PostgreSQL CI shares one database across files; leave no gallery fixture behind.
  const db=await getDb();
  await db.query("delete from accounts where discord_id in ('collection-owner','collection-other')");
  await db.query("delete from cards where def_id='CollectionTest'");
});
beforeEach(async()=>{
  const db=await getDb();
  await db.query("delete from account_variants where owner_id in (9101,9102)");
  await db.query("delete from wishlist_shares where owner_id in (9101,9102)");
  await db.query("update cards set variants=$1::text::jsonb,reference_status='released' where def_id='CollectionTest'",[catalog]);
  vi.mocked(currentAccount).mockResolvedValue(owner);
});
it("requires authentication and rejects cross-origin mutations",async()=>{
  vi.mocked(currentAccount).mockResolvedValue(null);
  for(const response of [await GET(),await save({}),await POST(shareRequest()),await DELETE(shareRequest())]){
    expect(response.status).toBe(401);expect(response.headers.get("cache-control")).toContain("no-store");
  }
  vi.mocked(currentAccount).mockResolvedValue(owner);
  expect((await save({card:"CollectionTest",variant:"wanted",status:"wanted"},"https://elsewhere.example")).status).toBe(403);
  expect((await POST(new Request("http://localhost/api/collection/share",{method:"POST",headers:{Origin:"https://elsewhere.example"}}))).status).toBe(403);
  expect(sameOrigin(new Request("http://localhost:3101/api/collection",{headers:{Host:"127.0.0.1:3101",Origin:"http://127.0.0.1:3101"}}))).toBe(true);
  expect(sameOrigin(new Request("http://localhost:3101/api/collection",{headers:{Host:"snap-hub.app","X-Forwarded-Proto":"https",Origin:"https://elsewhere.example"}}))).toBe(false);
});
it("scopes every read, update and removal to the signed-in account",async()=>{
  expect((await save({card:"CollectionTest",variant:"owned",status:"owned",owner:other.id})).status).toBe(200);
  expect(await collection(owner.id)).toHaveLength(1);expect(await collection(other.id)).toEqual([]);
  vi.mocked(currentAccount).mockResolvedValue(other);
  expect(await (await GET()).json()).toEqual([]);
  await save({card:"CollectionTest",variant:"owned",status:null,owner:owner.id});
  expect(await collection(owner.id)).toHaveLength(1);
  await save({card:"CollectionTest",variant:"owned",status:"wanted"});
  expect((await collection(owner.id))[0].status).toBe("owned");
  expect((await collection(other.id))[0].status).toBe("wanted");
});
it("validates catalog membership and preview status, and allows removal after catalog changes",async()=>{
  for(const body of [null,[],{card:1},{card:"CollectionTest",variant:"unknown",status:"owned"},{card:"CollectionTest",variant:"preview",status:"owned"},{card:"CollectionTest",variant:"owned",status:"public"}])expect((await save(body)).status).toBe(400);
  expect((await save({card:"CollectionTest",variant:"preview",status:"wanted"})).status).toBe(200);
  await (await getDb()).query("update cards set variants='[]'::jsonb where def_id='CollectionTest'");
  expect((await collection(owner.id))[0].variant).toBeNull();
  expect((await save({card:"CollectionTest",variant:"preview",status:null})).status).toBe(200);
  expect(await collection(owner.id)).toEqual([]);
  await (await getDb()).query("update cards set variants=$1::text::jsonb,reference_status='unreleased' where def_id='CollectionTest'",[catalog]);
  expect(await findVariant("CollectionTest","owned")).toBeNull();
  expect((await save({card:"CollectionTest",variant:"owned",status:"owned"})).status).toBe(400);
});
it("shares only wanted entries, live updates, and permanently revokes the old token",async()=>{
  await save({card:"CollectionTest",variant:"owned",status:"owned"});
  await save({card:"CollectionTest",variant:"wanted",status:"wanted"});
  expect(await shareToken(owner.id)).toBeNull();
  const [a,b]=await Promise.all([enableShare(owner.id),enableShare(owner.id)]);expect(a).toBe(b);
  const shared=await sharedWishlist(a);
  expect(shared?.items.map(v=>v.variant_id)).toEqual(["wanted"]);
  expect(Object.keys(shared!)).toEqual(["username","items"]);
  await save({card:"CollectionTest",variant:"wanted",status:"owned"});
  expect((await sharedWishlist(a))?.items).toEqual([]);
  await disableShare(other.id);expect(await sharedWishlist(a)).not.toBeNull();
  await disableShare(owner.id);expect(await sharedWishlist(a)).toBeNull();
  expect(await enableShare(owner.id)).not.toBe(a);
  expect(await sharedWishlist("bad-token")).toBeNull();
});
it("counts one artwork per artist even with multiple roles, and round-trips unusual selection IDs",async()=>{
  expect((await artists({name:"Collection & Artist"}))[0]).toMatchObject({total:3,released:2,roles:["Color","Sketch"]});
  expect(parseVariantKey(variantKey("A/&?#","Variant \"1\""))).toEqual(["A/&?#","Variant \"1\""]);
  for(const input of ["oops","{}",'[1,2]','["x"]','["","a"]'])expect(parseVariantKey(input)).toBeNull();
});
