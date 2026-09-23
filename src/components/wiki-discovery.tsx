import Link from "next/link";
import { getDb } from "@/lib/db";
import { ARCHETYPES } from "@/lib/wiki/archetypes";
import { stripTags } from "@/lib/wiki/filter";
import { WikiArt } from "./wiki-art";

// The general keywords plus every archetype's own mechanic. Bounce ("return") and Zoo ("1-cost")
// were missing from this list, so their guides could never be reached from a card's text.
const mechanics = [...new Set(["on reveal", "ongoing", "activate", "destroy", "discard", "move", "draw", ...ARCHETYPES.map((a) => a.mechanic)])];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A term matches at the start of a word, so "move" finds move, moves and moved but not remove,
 * and "draw" is not found inside withdraw. It was a bare substring match, so every card whose
 * text said "remove" was filed under Move and listed six unrelated cards as references.
 */
function mentions(ability: string): string[] {
  const text = stripTags(ability);
  return mechanics.filter((term) => new RegExp(`\\b${escape(term)}`, "i").test(text));
}

/** Up to six other cards and locations whose text uses one of `terms` as a word. */
export async function related(id: string, terms: string[]) {
  if (!terms.length) return [];
  const db = await getDb();
  // \m is Postgres for "start of a word", the same rule as `mentions` above.
  return db.query<{ def_id: string; name: string; art: string; kind: string }>(`with related as (
      select def_id,name,art,ability,'cards' as kind from cards where reference_status='released'
      union all select def_id,name,art,ability,'locations' as kind from locations where status='released'
    ) select def_id,name,art,kind from related where def_id<>$1 and exists(
      select 1 from unnest($2::text[]) pattern
      where lower(regexp_replace(ability,'<[^>]*>','','g')) ~ pattern
    ) order by kind desc,lower(name),def_id limit 6`,
    [id, terms.map((t) => `\\m${escape(t.toLowerCase())}`)]);
}

export async function WikiDiscovery({ id, ability }: { id: string; ability: string }) {
  const terms = mentions(ability);
  const guides = ARCHETYPES.filter((a) => a.cards.some((c) => c.id === id) || terms.includes(a.mechanic));
  let rows: Awaited<ReturnType<typeof related>> = [];
  if (terms.length) {
    try {
      rows = await related(id, terms);
    } catch (error) {
      // An optional panel. Losing it must not take the card page down with it.
      console.error("Wiki discovery unavailable", error);
    }
  }
  return <section aria-labelledby="discover-heading" className="my-8 rounded-xl border border-line p-5"><h2 id="discover-heading" className="text-xl font-bold">Keep exploring</h2>
    <div className="my-4 flex flex-wrap gap-4 text-sm text-accent">{guides.map(g=><Link key={g.slug} className="underline" href={`/wiki/archetypes/${g.slug}`}>{g.title} game plan</Link>)}<Link className="underline" href="/wiki/terminology">SNAP terminology</Link></div>
    {!!rows.length&&<><p className="mb-4 text-xs text-muted">Other references mentioning {terms.join(", ")}. Shared wording is a discovery aid, not a recommendation to combine these effects.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map(r=><Link href={`/wiki/${r.kind}/${encodeURIComponent(r.def_id)}`} key={`${r.kind}:${r.def_id}`} className="brand-tile flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface p-3"><div className="w-14 shrink-0"><WikiArt name={r.name} art={r.art}/></div><div className="min-w-0"><p className="text-xs text-muted">{r.kind==="cards"?"Card":"Location"}</p><p className="break-words text-sm font-bold">{r.name}</p></div></Link>)}</div></>}
  </section>;
}

export { mentions };
