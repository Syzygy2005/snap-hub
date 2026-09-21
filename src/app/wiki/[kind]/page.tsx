import { PageHeader, EmptyState } from "@/components/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { entries } from "@/lib/wiki/queries";
import { filterEntries, pageHref, value } from "@/lib/wiki/filter";
import { WikiArt } from "@/components/wiki-art";
import { AbilityText } from "@/components/cards";
import { ReferenceStatus } from "@/components/wiki-reference";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: PageProps<"/wiki/[kind]">): Promise<Metadata> {
  const {kind} = await params;
  return { title: kind === "cards" ? "Card library" : "Location atlas", alternates: { canonical: `/wiki/${kind}` } };
}
export default async function Gallery(props: PageProps<"/wiki/[kind]">) {
  const {kind} = await props.params;
  if (kind !== "cards" && kind !== "locations") notFound();
  const sp = await props.searchParams;
  const all = await entries(kind);
  const result = filterEntries(all,sp);
  const options = (field: "cost" | "power" | "series" | "rarity") => [...new Set(all.filter(e => e.status === "released").map(e => String(e[field])))].sort((a,b) => field === "cost" || field === "power" ? Number(a)-Number(b) : a.localeCompare(b));
  return <>
    <PageHeader title={kind === "cards" ? "Card library" : "Location atlas"} subtitle={`Released ${kind}, with the latest available reference data.`} />
    <ReferenceStatus kind={kind} />
    <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4" action={`/wiki/${kind}`}>
      <label className="min-w-0 grow text-xs">Search name or effect<input name="q" defaultValue={value(sp,"q")} className="mt-1 block w-full rounded border border-line bg-bg p-2 text-sm" placeholder="Try move, destroy, or a name" /></label>
      {(kind === "cards" ? ["cost","power","series"] as const : ["rarity"] as const).map(field => <label key={field} className="text-xs capitalize">{field}<select name={field} defaultValue={value(sp,field)} className="mt-1 block max-w-48 rounded border border-line bg-bg p-2 text-sm"><option value="">All</option>{options(field).map(v => <option key={v}>{v}</option>)}</select></label>)}
      <label className="text-xs">Mechanic<select name="keyword" defaultValue={value(sp,"keyword")} className="mt-1 block rounded border border-line bg-bg p-2 text-sm"><option value="">All</option>{["On Reveal","Ongoing","Activate","Move","Destroy","Discard","Draw"].map(v => <option key={v}>{v}</option>)}</select></label>
      {kind === "cards" && <label className="text-xs">Category<select name="category" defaultValue={value(sp,"category")} className="mt-1 block rounded border border-line bg-bg p-2 text-sm"><option value="">All released</option><option value="deckable">Deck cards</option><option value="other">Other / mode cards</option></select></label>}
      <label className="text-xs">Sort<select name="sort" defaultValue={value(sp,"sort")} className="mt-1 block rounded border border-line bg-bg p-2 text-sm"><option value="">Name</option>{kind === "cards" && <><option value="cost">Energy: low first</option><option value="power">Power: high first</option></>}</select></label>
      <button className="brand-action hover:brightness-110 rounded bg-accent px-4 py-2 text-sm font-bold text-bg">Search</button><Link className="py-2 text-sm text-muted underline" href={`/wiki/${kind}`}>Reset</Link>
    </form>
    <p className="mb-4 text-sm text-muted">{result.total} results · Page {result.page} of {result.pages}</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{result.items.map(e => <Link key={e.def_id} href={`/wiki/${kind}/${encodeURIComponent(e.def_id)}`} className="brand-tile min-w-0 rounded-lg border border-line bg-surface p-3">
      <WikiArt name={e.name} art={e.art} /><h2 className="mt-2 text-sm font-bold">{e.name}</h2>
      <p className="my-2 text-xs text-accent">{kind === "cards" ? `${e.cost} Energy · ${e.power} Power` : e.rarity}</p>
      <p className="text-xs leading-relaxed text-muted"><AbilityText text={e.ability} /></p>
    </Link>)}</div>
    {!result.total && <EmptyState title={all.length ? "No matches yet" : "The library is warming up"}>{all.length ? <><p>Try fewer filters or a different search.</p><Link href={`/wiki/${kind}`} className="mt-4 inline-block text-accent underline">Clear filters</Link></> : "The reference library is awaiting its first successful update."}</EmptyState>}
    <nav aria-label="Wiki pages" className="mt-8 flex justify-between text-sm text-accent">{result.page > 1 ? <Link href={pageHref(`/wiki/${kind}`,sp,result.page-1)}>← Previous</Link> : <span />}{result.page < result.pages && <Link href={pageHref(`/wiki/${kind}`,sp,result.page+1)}>Next →</Link>}</nav>
  </>;
}
