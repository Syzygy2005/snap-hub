import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { artists,browseVariants } from "@/lib/wiki/variant-browser";
import { artistHref } from "@/lib/wiki/variant-key";
import { pageHref,value } from "@/lib/wiki/filter";
import { WikiArt } from "@/components/wiki-art";
import { VariantGrid } from "@/components/variant-grid";
import { ReferenceStatus } from "@/components/wiki-reference";
async function routeArtistName(props:PageProps<"/wiki/artists/[name]">) {
  const {name}=await props.params;
  // This Next version exposes encoded path segments. Decode exactly once (literal % stays literal).
  try { return decodeURIComponent(name); } catch { notFound(); }
}
export async function generateMetadata(props:PageProps<"/wiki/artists/[name]">):Promise<Metadata> {
  const name=await routeArtistName(props);return {title:`${name} · Variant artist`,alternates:{canonical:artistHref(name)}};
}
export default async function ArtistPage(props:PageProps<"/wiki/artists/[name]">) {
  const name=await routeArtistName(props),sp=await props.searchParams;
  const rows=await artists(name);
  const artist=rows.find(a=>a.name===name);if(!artist)notFound();
  const result=await browseVariants({...sp,artist:name});
  const base=artistHref(name);
  return <><header className="mb-8 grid items-center gap-6 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-[12rem_1fr]"><div className="mx-auto w-40 sm:w-full"><WikiArt featured art={artist.art} name={`Featured artwork credited to ${name}`}/></div><div><p className="text-xs font-bold uppercase tracking-widest text-accent">Artist spotlight</p><h1 className="mt-3 break-words font-display text-4xl font-bold">{name}</h1><p className="mt-4 text-muted">{artist.roles.join(" · ")}</p><p className="mt-3 text-sm text-muted">{artist.released} released variants · {artist.total-artist.released} unreleased previews</p><p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">A gallery of artwork credited to {name} in <a className="underline" href="https://marvelsnapzone.com/variants/">Marvel Snap Zone</a>. A piece appears once even when multiple roles are credited. Names and roles reproduce the catalog; no biography or identity verification is implied.</p></div></header>
    <form key={JSON.stringify(sp)} action={base} className="mb-6 flex flex-wrap items-end gap-3"><label className="text-sm">Search this gallery<input type="search" name="q" maxLength={100} defaultValue={value(sp,"q")} className="mt-1 block rounded border border-line bg-bg p-2"/></label><label className="text-sm">Release status<select name="status" defaultValue={result.status} className="mt-1 block rounded border border-line bg-bg p-2"><option value="released">Released</option><option value="unreleased">Unreleased previews</option></select></label><label className="text-sm">Sort<select name="sort" defaultValue={value(sp,"sort")} className="mt-1 block rounded border border-line bg-bg p-2"><option value="">Card name</option><option value="newest">Newest source date</option></select></label><button className="rounded bg-accent px-4 py-2 font-bold text-bg">Apply filters</button></form>
    <p className="mb-4 text-sm text-muted">{result.total} variants · Page {result.page} of {result.pages}</p><VariantGrid items={result.items}/>{!result.total&&<p className="my-8 text-muted">No artwork matches these filters. Try the other release status or clear your search.</p>}
    <nav aria-label="Artist gallery pages" className="my-8 flex justify-between text-sm text-accent">{result.page>1?<Link href={pageHref(base,sp,result.page-1)}>← Previous</Link>:<span/>}{result.page<result.pages&&<Link href={pageHref(base,sp,result.page+1)}>Next →</Link>}</nav><ReferenceStatus kind="cards"/>
  </>;
}
