import Link from "next/link";
import { getDb } from "@/lib/db";
import { artists } from "@/lib/wiki/variant-browser";
import { artistHref } from "@/lib/wiki/variant-key";
import { WikiArt } from "./wiki-art";
import { AbilityText } from "./cards";
export async function WikiSpotlight() {
  const day=new Date().toISOString().slice(0,10),db=await getDb();
  const [cards,locations,credits]=await Promise.all([
    db.query<{def_id:string;name:string;art:string;ability:string}>("select def_id,name,art,ability from cards where reference_status='released' and deckable=true order by md5(def_id||$1) limit 1",[day]),
    db.query<{def_id:string;name:string;art:string;ability:string}>("select def_id,name,art,ability from locations where status='released' order by md5(def_id||$1) limit 1",[day]),artists({seed:day,limit:1})
  ]);
  const artist=credits[0] ?? null;
  return <section aria-labelledby="spotlight-heading" className="wiki-spotlights mb-9">
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 id="spotlight-heading" className="font-display text-2xl font-bold">A little discovery, every day.</h2><span className="text-xs text-muted">Daily picks · {day} UTC</span></div>
    <div className="grid gap-4 md:grid-cols-3">{[{item:cards[0],kind:"cards",label:"Card of the day"},{item:locations[0],kind:"locations",label:"Location spotlight"}].map(({item,kind,label})=><article key={kind} className="overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface to-bg p-5"><p className="text-xs font-bold uppercase tracking-widest text-accent">{label}</p>{item?<><Link href={`/wiki/${kind}/${encodeURIComponent(item.def_id)}`}><div className="mx-auto max-w-60"><WikiArt featured name={item.name} art={item.art}/></div><h3 className="mt-3 font-display text-2xl font-bold">{item.name} →</h3></Link><p className="mt-3 text-sm leading-relaxed text-muted"><AbilityText text={item.ability}/></p></>:<p className="my-8 text-sm text-muted">Today’s reference pick will appear after the catalog’s first import.</p>}</article>)}
      <article className="overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface to-bg p-5"><p className="text-xs font-bold uppercase tracking-widest text-accent">Artist spotlight</p>{artist?<><Link href={artistHref(artist.name)}><div className="mx-auto max-w-60"><WikiArt featured name={`Artwork credited to ${artist.name}`} art={artist.art}/></div><h3 className="mt-3 break-words font-display text-2xl font-bold">{artist.name} →</h3></Link><p className="mt-3 text-sm text-muted">{artist.roles.join(" · ")} · {artist.total} credited variants</p></>:<p className="my-8 text-sm text-muted">Artist spotlights arrive with the variant catalog.</p>}</article>
    </div>
  </section>;
}
