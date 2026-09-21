import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { entries, history } from "@/lib/wiki/queries";
import { listDecks } from "@/lib/decks/queries";
import { WikiArt } from "@/components/wiki-art";
import { AbilityText } from "@/components/cards";
import { ReferenceStatus } from "@/components/wiki-reference";
export const dynamic = "force-dynamic";
async function find(kind: string,id: string) {
  if (kind !== "cards" && kind !== "locations") notFound();
  const entry = (await entries(kind)).find(e => e.def_id === id && e.status === "released");
  if (!entry) notFound();
  return {entry,kind: kind as "cards" | "locations"};
}
export async function generateMetadata({params}: PageProps<"/wiki/[kind]/[id]">): Promise<Metadata> {
  const {kind,id} = await params; const {entry} = await find(kind,id);
  const description = entry.ability.replace(/<[^>]*>/g, "") || `${entry.name} reference and stats.`;
  return {title: entry.name, description, alternates: { canonical: `/wiki/${kind}/${encodeURIComponent(id)}` }, openGraph: { title: entry.name, description, ...(entry.art ? {images: [{url:entry.art,alt:entry.name}]} : {}) }};
}
export default async function Detail({params}: PageProps<"/wiki/[kind]/[id]">) {
  const {kind: input,id} = await params; const {entry: e,kind} = await find(input,id);
  const [changes,decks] = await Promise.all([history(kind,id),kind === "cards" ? listDecks({cards:[id],limit:6}) : Promise.resolve([])]);
  return <>
    <Link className="text-sm text-muted underline" href={`/wiki/${kind}`}>← All {kind}</Link>
    <div className="bg-surface mt-5 grid items-center gap-8 rounded-xl border border-line p-6 sm:p-10 md:grid-cols-[minmax(0,320px)_1fr]">
      <WikiArt name={e.name} art={e.art} featured />
      <div className="min-w-0"><p className="text-xs uppercase tracking-widest text-accent">{kind === "cards" ? e.series : `${e.rarity} location`}</p><h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{e.name}</h1>
      {kind === "cards" && <div className="my-5 flex gap-8"><p><strong className="num text-3xl text-gem-blue">{e.cost}</strong><span className="ml-2 text-sm text-muted">Energy</span></p><p><strong className="num text-3xl text-accent">{e.power}</strong><span className="ml-2 text-sm text-muted">Power</span></p></div>}
      <p className="mt-5 text-lg leading-relaxed"><AbilityText text={e.ability} /></p>
      {kind === "cards" && (e.deckable ? <Link className="hover:brightness-110 mt-6 inline-block rounded bg-accent px-5 py-3 text-sm font-bold text-bg" href={`/decks/builder?add=${encodeURIComponent(id)}`}>Add to builder</Link> : <p className="mt-5 text-sm text-muted">Other / mode card · unavailable for standard deck building.</p>)}
      {kind === "locations" && <p className="mt-5 text-xs text-muted">Rarity is the source’s category, not a guaranteed appearance rate.</p>}</div>
    </div>
    <ReferenceStatus kind={kind} />
    {e.def_id.startsWith("SnapZoneLocation_") && <p className="text-xs text-muted">This source entry has no game identifier. Its reference link uses the provider’s stable ID; match-history linking is unavailable.</p>}
    {kind === "cards" && <section className="my-8"><h2 className="mb-3 text-xl font-bold">Public decks with {e.name}</h2>{decks.length ? <div className="flex flex-wrap gap-3">{decks.map(d => <Link className="hover:border-accent focus-visible:border-accent rounded border border-line bg-surface p-4" href={`/decks/${d.id}`} key={d.id}>{d.name}</Link>)}</div> : <p className="text-sm text-muted">No public decks found yet.</p>}</section>}
    <section className="my-8"><h2 className="mb-3 text-xl font-bold">Observed changes</h2><p className="mb-4 text-xs text-muted">Recorded from successful imports after the initial baseline. Dates show detection time, not the game’s patch time.</p>
    {changes.length ? changes.map(c => <article key={c.id} className="mb-3 rounded border border-line p-4"><time className="text-xs text-muted">{c.detected_at.toUTCString()}</time>{Object.keys(c.after_data).filter(k => c.before_data[k] !== c.after_data[k]).map(k => <p key={k} className="mt-2 break-words text-sm"><strong className="capitalize">{k}: </strong><span className="text-muted">{String(c.before_data[k]).replace(/<[^>]*>/g, "")}</span> → {String(c.after_data[k]).replace(/<[^>]*>/g, "")}</p>)}</article>) : <p className="text-sm text-muted">No changes recorded since the baseline import.</p>}</section>
  </>;
}
