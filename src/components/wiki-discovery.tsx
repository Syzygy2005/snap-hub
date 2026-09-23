import Link from "next/link";
import { getDb } from "@/lib/db";
import { ARCHETYPES } from "@/lib/wiki/archetypes";
import { WikiArt } from "./wiki-art";
const mechanics=["on reveal","ongoing","activate","destroy","discard","move","draw"];
export async function WikiDiscovery({id,ability}: {id:string;ability:string}) {
  const terms=mechanics.filter(term=>ability.toLowerCase().includes(term));
  const guides=ARCHETYPES.filter(a=>a.cards.some(c=>c.id===id)||terms.includes(a.mechanic));
  const db=await getDb();
  const rows=terms.length?await db.query<{def_id:string;name:string;art:string;kind:string}>(`with related as (
      select def_id,name,art,ability,'cards' as kind from cards where reference_status='released'
      union all select def_id,name,art,ability,'locations' as kind from locations where status='released'
    ) select def_id,name,art,kind from related where def_id<>$1 and exists(
      select 1 from unnest($2::text[]) term where lower(ability) like '%'||term||'%'
    ) order by kind desc,lower(name),def_id limit 6`,[id,terms]):[];
  return <section aria-labelledby="discover-heading" className="my-8 rounded-xl border border-line p-5"><h2 id="discover-heading" className="text-xl font-bold">Keep exploring</h2>
    <div className="my-4 flex flex-wrap gap-4 text-sm text-accent">{guides.map(g=><Link key={g.slug} className="underline" href={`/wiki/archetypes/${g.slug}`}>{g.title} game plan</Link>)}<Link className="underline" href="/wiki/interactions">Practice priority and interactions</Link><Link className="underline" href="/wiki/terminology">SNAP terminology</Link></div>
    {!!rows.length&&<><p className="mb-4 text-xs text-muted">Other references mentioning {terms.join(", ")}. Shared wording is a discovery aid, not a recommendation to combine these effects.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map(r=><Link href={`/wiki/${r.kind}/${encodeURIComponent(r.def_id)}`} key={`${r.kind}:${r.def_id}`} className="brand-tile flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface p-3"><div className="w-14 shrink-0"><WikiArt name={r.name} art={r.art}/></div><div className="min-w-0"><p className="text-xs text-muted">{r.kind==="cards"?"Card":"Location"}</p><p className="break-words text-sm font-bold">{r.name}</p></div></Link>)}</div></>}
  </section>;
}
