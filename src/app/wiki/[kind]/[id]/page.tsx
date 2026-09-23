import { WikiDiscovery } from "@/components/wiki-discovery";
import { cache, Suspense } from "react";
import { LocationRate } from "@/components/location-rate";
import { CardVariants } from "@/components/card-variants";
import { CardHistory } from "@/components/card-history";
import { officialMentions, PATCH_ARCHIVE } from "@/lib/wiki/patches";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { entry, history } from "@/lib/wiki/queries";
import { listDecks } from "@/lib/decks/queries";
import { WikiArt } from "@/components/wiki-art";
import { AbilityText } from "@/components/cards";
import { ReferenceStatus } from "@/components/wiki-reference";
export const dynamic = "force-dynamic";
// One indexed lookup, and cached so generateMetadata and the page share it. This used to read
// every card or location row and Array.find one out of it, twice per request.
const find = cache(async (kind: string,id: string) => {
  if (kind !== "cards" && kind !== "locations") notFound();
  const found = await entry(kind,id);
  if (!found) notFound();
  return {entry: found,kind: kind as "cards" | "locations"};
});
export async function generateMetadata({params}: PageProps<"/wiki/[kind]/[id]">): Promise<Metadata> {
  const {kind,id} = await params; const {entry} = await find(kind,id);
  const description = entry.ability.replace(/<[^>]*>/g, "") || `${entry.name} reference and stats.`;
  return {title: entry.name, description, alternates: { canonical: `/wiki/${kind}/${encodeURIComponent(id)}` }, openGraph: { title: entry.name, description, ...(entry.art ? {images: [{url:entry.art,alt:entry.name}]} : {}) }};
}
export default async function Detail({params}: PageProps<"/wiki/[kind]/[id]">) {
  const {kind: input,id} = await params; const {entry: e,kind} = await find(input,id);
  const [changes,decks] = await Promise.all([history(kind,id),kind === "cards" ? listDecks({cards:[id],limit:6}) : Promise.resolve([])]);
  const mentions = officialMentions(kind, id);
  return <>
    <Link className="text-sm text-muted underline" href={`/wiki/${kind}`}>← All {kind}</Link>
    <div className="bg-surface mt-5 grid items-center gap-8 rounded-xl border border-line p-6 sm:p-10 md:grid-cols-[minmax(0,320px)_1fr]">
      <WikiArt name={e.name} art={e.art} featured />
      <div className="min-w-0"><p className="text-xs uppercase tracking-widest text-accent">{kind === "cards" ? e.series : `${e.rarity} location`}</p><h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{e.name}</h1>
      {kind === "cards" && <div className="my-5 flex gap-8"><p><strong className="num text-3xl text-gem-blue">{e.cost}</strong><span className="ml-2 text-sm text-muted">Energy</span></p><p><strong className="num text-3xl text-accent">{e.power}</strong><span className="ml-2 text-sm text-muted">Power</span></p></div>}
      <p className="mt-5 text-lg leading-relaxed"><AbilityText text={e.ability} /></p>
      {kind === "cards" && (e.deckable ? <Link className="brand-action hover:brightness-110 mt-6 inline-block rounded bg-accent px-5 py-3 text-sm font-bold text-bg" href={`/decks/builder?add=${encodeURIComponent(id)}`}>Add to builder</Link> : <p className="mt-5 text-sm text-muted">Other / mode card · unavailable for standard deck building.</p>)}
      {kind === "locations" && <p className="mt-5 text-xs text-muted">Rarity is the source’s category, not a guaranteed appearance rate.</p>}</div>
    </div>
    <section className="my-8 rounded-xl border border-line bg-surface/40 p-5">
      <h2 className="mb-3 text-xl font-bold">Reference facts</h2>
      <dl className="grid gap-4 text-sm sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <div><dt className="text-muted">Reference ID</dt><dd className="mt-1 break-all font-medium">{e.def_id}</dd></div>
        <div><dt className="text-muted">{kind === "cards" ? "Collection series" : "Source rarity"}</dt><dd className="mt-1 font-medium">{kind === "cards" ? e.series || "Not specified" : e.rarity}</dd></div>
        {kind === "cards" ? <div><dt className="text-muted">Standard deck building</dt><dd className="mt-1 font-medium">{e.deckable ? "Available" : "Unavailable / other mode"}</dd></div> : <Suspense fallback={null}><LocationRate id={id} /></Suspense>}
      </dl>
      {e.tags.length > 0 && <p className="mt-4 text-sm text-muted">Source tags: {e.tags.join(", ")}</p>}
    </section>
    <ReferenceStatus kind={kind} />
    <WikiDiscovery id={id} ability={e.ability} />
    {e.def_id.startsWith("SnapZoneLocation_") && <p className="text-xs text-muted">This source entry has no game identifier. Its reference link uses the provider’s stable ID; match-history linking is unavailable.</p>}
    {kind === "cards" && <section className="my-8"><h2 className="mb-3 text-xl font-bold">Public decks with {e.name}</h2>{decks.length ? <div className="flex flex-wrap gap-3">{decks.map(d => <Link className="brand-tile rounded border border-line bg-surface p-4" href={`/decks/${d.id}`} key={d.id}>{d.name}</Link>)}</div> : <p className="text-sm text-muted">No public decks found yet.</p>}</section>}
    {kind === "cards" && <CardVariants id={id} name={e.name} />}
    {kind === "cards" && <Suspense fallback={<p role="status" className="my-8 text-sm text-muted">Loading historical card versions…</p>}><CardHistory id={id} /></Suspense>}
    <section className="my-8">
      <h2 className="mb-3 text-xl font-bold">Official patch-note mentions</h2>
      <p className="mb-4 text-sm text-muted">Historical articles that mention {e.name}, including balance changes, fixes, or discussion. A mention is not necessarily a change. Indexed {PATCH_ARCHIVE.indexedAt.slice(0,10)}; coverage is incomplete.</p>
      {mentions.length ? <ul className="space-y-3">{mentions.map(note => <li key={note.url} className="rounded-lg border border-line p-4">
        <p className="text-xs text-muted">{note.date ? <time dateTime={note.date}>{note.date}</time> : note.publishedAt ? `Published ${note.publishedAt}` : "Date not confirmed"}</p>
        <a className="mt-1 inline-block font-semibold text-accent hover:underline" href={note.url}>{note.title} ↗</a>
      </li>)}</ul> : <p className="text-sm text-muted">No matching article in this index. That does not mean this entry has never changed.</p>}
      <Link href="/wiki/history" className="mt-4 inline-block text-sm text-accent underline">Browse the official patch archive and other history sources</Link>
    </section>
    <section className="my-8"><h2 className="mb-3 text-xl font-bold">Observed changes</h2><p className="mb-4 text-xs text-muted">Recorded from successful imports after the initial baseline. Dates show detection time, not the game’s patch time.</p>
    {changes.length ? changes.map(c => <article key={c.id} className="mb-3 rounded border border-line p-4"><time className="text-xs text-muted">{c.detected_at.toUTCString()}</time>{Object.keys(c.after_data).filter(k => c.before_data[k] !== c.after_data[k]).map(k => <p key={k} className="mt-2 break-words text-sm"><strong className="capitalize">{k}: </strong><span className="text-muted">{String(c.before_data[k]).replace(/<[^>]*>/g, "")}</span> → {String(c.after_data[k]).replace(/<[^>]*>/g, "")}</p>)}</article>) : <p className="text-sm text-muted">No changes recorded since the baseline import.</p>}</section>
  </>;
}
