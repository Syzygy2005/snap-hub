import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/pager";
import { artists } from "@/lib/wiki/variant-browser";
import { artistHref } from "@/lib/wiki/variant-key";
import { clampPage, value } from "@/lib/wiki/filter";
import { WikiArt } from "@/components/wiki-art";
import { PageHeader,EmptyState } from "@/components/ui";
export const metadata:Metadata={title:"Variant artists",description:"Explore the sketch, ink and color artists behind MARVEL SNAP variants.",alternates:{canonical:"/wiki/artists"}};
export default async function ArtistsPage(props:PageProps<"/wiki/artists">) {
  const sp=await props.searchParams,rows=await artists({q:value(sp,"q")});
  if(value(sp,"sort")==="most")rows.sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
  const {page,pages}=clampPage(value(sp,"page"),rows.length,24);
  return <><PageHeader title="The people behind the art." subtitle="Explore sketch, ink and color credits across the variant collection."/>
    <form key={JSON.stringify(sp)} action="/wiki/artists" className="mb-6 flex flex-wrap items-end gap-3"><label className="text-sm">Find an artist<input type="search" maxLength={100} name="q" defaultValue={value(sp,"q")} className="mt-1 block rounded border border-line bg-bg p-2"/></label><label className="text-sm">Sort<select name="sort" defaultValue={value(sp,"sort")} className="mt-1 block rounded border border-line bg-bg p-2"><option value="">Name</option><option value="most">Most credited variants</option></select></label><button className="rounded bg-jade px-4 py-2 font-bold text-forest">Find artists</button></form>
    <p className="mb-4 text-sm text-muted">{rows.length} credited names · Page {page} of {pages}. Credits follow Marvel Snap Zone; the same piece counts once per artist.</p>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.slice((page-1)*24,page*24).map(a=><Link href={artistHref(a.name)} key={a.name} className="brand-tile grid min-w-0 grid-cols-[6rem_1fr] items-center gap-4 rounded-xl border border-line bg-surface p-4"><WikiArt name={`Artwork credited to ${a.name}`} art={a.art}/><div className="min-w-0"><h2 className="break-words font-display text-lg font-bold">{a.name}</h2><p className="mt-2 text-xs text-accent">{a.roles.join(" · ")}</p><p className="mt-2 text-xs text-muted">{a.released} released · {a.total-a.released} previews</p></div></Link>)}</div>
    {!rows.length&&<EmptyState title="No artists found"><p>Try another name. Credits appear after the first successful variant import.</p></EmptyState>}
    <Pager label="Artist pages" base={"/wiki/artists"} sp={sp} page={page} pages={pages}/>
  </>;
}
