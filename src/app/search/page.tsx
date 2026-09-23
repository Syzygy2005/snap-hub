import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { WikiArt } from "@/components/wiki-art";
import { searchSite } from "@/lib/search";
import { cleanQuery, value } from "@/lib/wiki/filter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {title:"Search Snap Hub",description:"Find cards, locations, variants, artists, wiki guides, players and public decks.",robots:{index:false,follow:true}};
export default async function SearchPage(props: PageProps<"/search">) {
  const q = cleanQuery(value(await props.searchParams,"q"));
  const groups = await searchSite(q);
  const matches = groups.reduce((n,g)=>n+g.items.length,0);
  const failed = groups.some(g=>g.unavailable);
  return <>
    <PageHeader title="Search Snap Hub" subtitle="Cards, locations, variants, artists, guides, players and public decks—all in one place." />
    <form action="/search" role="search" aria-label="Search results" className="mb-6 flex flex-wrap gap-3">
      <label className="min-w-0 flex-1 text-sm">Search everything<input key={q} name="q" type="search" maxLength={100} defaultValue={q} placeholder="Try a card, artist, location or SNAP term" className="mt-2 block w-full rounded-lg border border-line bg-surface px-4 py-3" /></label>
      <button className="self-end rounded-lg bg-accent px-5 py-3 font-bold text-bg">Search</button>
    </form>
    {!q ? <EmptyState title="What are you looking for?">Enter a name, artist or term above. Try “Asgard”, “On Reveal” or “Conquest”.</EmptyState> : <>
      <p className="mb-4 break-words text-sm text-muted">Results for “{q}”</p>
      <nav aria-label="Result categories" className="mb-6 flex flex-wrap gap-2">{groups.filter(g=>g.items.length || g.unavailable).map(g=><a key={g.title} href={`#results-${groups.indexOf(g)}`} className="rounded-full border border-line px-3 py-1.5 text-xs text-accent">{g.title}{g.unavailable ? " · unavailable" : ` · ${g.items.length}${g.more ? "+" : ""}`}</a>)}</nav>
      {failed && <p role="status" className="mb-5 rounded border border-line p-4 text-sm text-muted">Some search categories are temporarily unavailable. Available results are shown below; try again to refresh the missing categories.</p>}
      {!matches && !failed && <EmptyState title="No matches found">Try a shorter name, another spelling, or a different term. Unreleased variants are available through the variant gallery’s preview filter.</EmptyState>}
      <div className="grid items-start gap-6 lg:grid-cols-2">{groups.map((g,i)=>g.items.length || g.unavailable ? <section key={g.title} id={`results-${i}`} aria-labelledby={`heading-${i}`} className="min-w-0 scroll-mt-48 rounded-xl border border-line bg-surface/40">
        <h2 id={`heading-${i}`} className="border-b border-line px-5 py-4 font-display text-xl font-bold">{g.title}</h2>
        {g.unavailable ? <p className="p-5 text-sm text-muted">This category could not be loaded.</p> : <ul>{g.items.map(item=><li key={item.href} className="border-b border-line/60 last:border-0"><Link href={item.href} className="flex items-center gap-4 p-4 hover:bg-surface-2">
          {item.art && <div className="w-14 shrink-0"><WikiArt name={item.title} art={item.art} /></div>}
          <div className="min-w-0"><h3 className="break-words text-sm font-semibold text-accent">{item.title}</h3><p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-muted">{item.description}</p></div>
        </Link></li>)}</ul>}
        {g.more && <Link className="block border-t border-line px-5 py-3 text-sm text-accent hover:underline" href={g.more}>See all {g.title.toLowerCase()} matches →</Link>}
      </section> : null)}</div>
    </>}
  </>;
}
