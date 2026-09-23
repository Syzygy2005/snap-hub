import { artistHref, variantHref } from "@/lib/wiki/variant-key";
import { LEARNING_LINKS } from "@/lib/wiki/archetypes";
import { getDb } from "@/lib/db";
import { likePattern, listDecks } from "@/lib/decks/queries";
import { searchPlayers } from "@/lib/leaderboard/queries";
import { artists, browseVariants } from "@/lib/wiki/variant-browser";
import { searchGuides } from "@/lib/wiki/guides";
import { cleanQuery, stripTags } from "@/lib/wiki/filter";

export interface SiteResult { title: string; description: string; href: string; art?: string }
export interface SearchGroup { title: string; items: SiteResult[]; more?: string; unavailable?: boolean }
const LIMIT = 8;

async function referenceResults(kind: "cards" | "locations", q: string): Promise<SiteResult[]> {
  const db = await getDb();
  // kind is an internal union, never interpolated from user input.
  const status = kind === "cards" ? "reference_status" : "status";
  const rows = await db.query<{def_id:string;name:string;ability:string;art:string}>(
    `select def_id,name,ability,art from ${kind} where ${status}='released'
      and (lower(name) like $1 or lower(regexp_replace(ability,'<[^>]*>','','g')) like $1)
      order by (lower(name)=$2) desc,(lower(name) like $3) desc,lower(name),def_id limit $4`,
    [likePattern(q.toLowerCase()),q.toLowerCase(),likePattern(q.toLowerCase()).slice(1),LIMIT+1]);
  return rows.map(r => ({title:r.name,description:stripTags(r.ability),art:r.art,href:`/wiki/${kind}/${encodeURIComponent(r.def_id)}`}));
}

export async function searchSite(input: string): Promise<SearchGroup[]> {
  const q = cleanQuery(input);
  if (!q) return [];
  const query = new URLSearchParams({q});
  const requests: {title:string;more?:string;run:()=>Promise<SiteResult[]>}[] = [
    {title:"Cards",more:`/wiki/cards?${query}`,run:()=>referenceResults("cards",q)},
    {title:"Locations",more:`/wiki/locations?${query}`,run:()=>referenceResults("locations",q)},
    {title:"Variants",more:`/wiki/variants?${query}`,run:async()=>{
      const result = await browseVariants({q},LIMIT+1,{count:false});
      return result.items.map(({card_id,card_name,variant:v}) => ({
        title:`${card_name} · Variant ${v.order || v.id}`,art:v.art,href:variantHref(card_id,v.id),
        description:[v.rarity,...[...new Set(v.artists.map(a=>a.name))]].filter(Boolean).join(" · "),
      }));
    }},
    {title:"Artists",more:"/wiki/artists?"+query,run:async()=>(await artists({q,limit:LIMIT+1})).map(a=>({title:a.name,description:a.roles.join(" · ")+" · "+a.total+" credited variants",href:artistHref(a.name),art:a.art}))},
    {title:"Wiki guides",run:async()=>[...searchGuides(q),...LEARNING_LINKS.filter(g=>(g.title+" "+g.description).toLowerCase().includes(q.toLowerCase()))]},
    {title:"Players",more:`/players?${query}`,run:async()=>(await searchPlayers(q,LIMIT+1)).map(p=>({title:p.name,href:`/players/${p.id}`,description:p.latestRank ? `${p.onBoard ? "Rank" : "Last seen at rank"} #${p.latestRank} · ${p.latestSeason}` : "Player profile"}))},
    {title:"Public decks",more:`/decks?${query}`,run:async()=>(await listDecks({q,limit:LIMIT+1})).map(d=>({title:d.name,href:`/decks/${d.id}`,description:d.owner ? `Shared by ${d.owner}` : "Community deck"}))},
  ];
  const results = await Promise.allSettled(requests.map(r=>r.run()));
  return results.map((result,i)=>{
    const {title,more} = requests[i];
    if (result.status === "rejected") {
      console.error(`Search category unavailable: ${title}`,result.reason);
      return {title,items:[],unavailable:true};
    }
    // All guide hits stay available because there is no separate paginated guide search.
    return {title,items:more ? result.value.slice(0,LIMIT) : result.value,more:result.value.length>LIMIT ? more : undefined};
  });
}
