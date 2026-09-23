import { WikiSpotlight } from "@/components/wiki-spotlight";
import { PageHeader } from "@/components/ui";
import Link from "next/link";
import type { Metadata } from "next";
import { WIKI_GUIDES } from "@/lib/wiki/guides";
export const metadata: Metadata = { title:"MARVEL SNAP Wiki",alternates:{canonical:"/wiki"},description:"Cards, locations, variants, artists, game modes and guides to MARVEL SNAP." };
export default function WikiPage() { return <>
  <PageHeader title="Know your next move." subtitle="Explore the collection. Learn the rules. Find the art and the answers that bring SNAP to life." />
  <form action="/search" className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-5">
    <label className="min-w-0 grow text-sm font-semibold">Search the wiki and Snap Hub<input type="search" name="q" maxLength={100} placeholder="A card, location, artist or game term…" className="mt-2 block w-full rounded-lg border border-line bg-bg px-4 py-3 font-normal" /></label>
    <button className="brand-action rounded-lg bg-accent px-5 py-3 text-sm font-bold text-bg">Search</button>
  </form>
  <WikiSpotlight />
  <h2 className="mb-4 font-display text-xl font-bold">Explore the collection</h2>
  <div className="grid gap-4 sm:grid-cols-3">{[["cards","Card library","Current stats and effects, with variants and history."],["locations","Location atlas","Effects, rarity and observed appearance rates."],["variants","Variant gallery","Artwork from every card, filtered by artist and rarity."],["artists","Artist directory","Follow sketch, ink and color credits through the collection."],["my-collection","My collection","Save what you own, keep a wishlist and share your favorites."],["compare","Compare artwork","Put two variants side by side and find your favorite."]].map(([id,title,text])=><Link key={id} className="brand-tile rounded-xl border border-line bg-surface p-6" href={`/wiki/${id}`}><h3 className="font-display text-xl font-bold">{title} <span className="text-accent">→</span></h3><p className="mt-3 text-sm leading-relaxed text-muted">{text}</p></Link>)}</div>
  <h2 className="mb-4 mt-9 font-display text-xl font-bold">Learn the game</h2>
  <div className="grid gap-4 sm:grid-cols-2">{[...WIKI_GUIDES,{slug:"archetypes",title:"Deck archetypes",summary:"Core roles, game plans and substitutions for six deck families."},{slug:"interactions",title:"Interaction lab",summary:"Learn priority, cube stakes and ability interactions with hands-on examples."}].map(g=><Link key={g.slug} href={`/wiki/${g.slug}`} className="brand-tile rounded-xl border border-line bg-surface/50 p-6"><h3 className="font-display text-xl font-bold">{g.title} <span className="text-accent">→</span></h3><p className="mt-3 text-sm leading-relaxed text-muted">{g.summary}</p></Link>)}</div>
  <aside className="mt-8 rounded-xl border border-line p-5 text-sm leading-relaxed text-muted"><Link href="/wiki/history" className="font-semibold text-accent underline">Explore patch history</Link><p className="mt-2">Cards, locations and variants are checked hourly. Guides are edited by hand and show their review date. Source publication and scheduler delays can affect reference freshness.</p></aside>
</>; }
