import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/pager";
import { PageHeader, EmptyState } from "@/components/ui";
import { VariantGrid } from "@/components/variant-grid";
import { ReferenceStatus } from "@/components/wiki-reference";
import { browseVariants, variantFacets } from "@/lib/wiki/variant-browser";
import { value } from "@/lib/wiki/filter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Variant gallery", description: "Browse MARVEL SNAP variant artwork by card, artist and rarity.", alternates: { canonical: "/wiki/variants" } };

export default async function VariantsPage(props: PageProps<"/wiki/variants">) {
  const sp = await props.searchParams;
  const result = await browseVariants(sp);
  const facets = await variantFacets(result.status);
  const selectClass = "mt-1 block w-full rounded border border-line bg-bg p-2 text-sm";
  return <>
    <PageHeader title="Variant gallery" subtitle="Find your favorite artists. Explore artwork across the whole card collection." />
    <p className="mb-5 max-w-3xl text-sm leading-relaxed text-muted">Artist credits include sketch, ink and color. Rarity and release status follow the source; released does not mean available in the shop today. <Link className="text-accent underline" href="/wiki/collection">Learn about variants and cosmetics</Link>.</p>
    <form key={JSON.stringify(sp)} action="/wiki/variants" className="mb-6 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="min-w-0 text-xs">Search variants<input name="q" type="search" maxLength={100} defaultValue={value(sp,"q")} placeholder="Card, artist, rarity or variant ID" className={selectClass} /></label>
      <label className="min-w-0 text-xs">Artist<select name="artist" defaultValue={value(sp,"artist")} className={selectClass}><option value="">All artists</option>{[...new Set([...facets.artists, value(sp,"artist")].filter(Boolean))].map(a => <option key={a}>{a}</option>)}</select></label>
      <label className="min-w-0 text-xs">Rarity / source category<select name="rarity" defaultValue={value(sp,"rarity")} className={selectClass}><option value="">All categories</option>{[...new Set([...facets.rarities,value(sp,"rarity")].filter(Boolean))].map(r => <option key={r}>{r}</option>)}</select></label>
      <label className="text-xs">Release status<select name="status" defaultValue={result.status} className={selectClass}><option value="released">Released</option><option value="unreleased">Unreleased previews</option></select></label>
      <label className="text-xs">Sort<select name="sort" defaultValue={value(sp,"sort")} className={selectClass}><option value="">Card name</option><option value="newest">Newest source date</option></select></label>
      {value(sp,"card") && <input type="hidden" name="card" value={value(sp,"card")} />}
      <div className="flex items-end gap-4"><button className="brand-action rounded bg-accent px-4 py-2 text-sm font-bold text-bg">Apply filters</button><Link href="/wiki/variants" className="py-2 text-sm text-muted underline">Reset</Link></div>
    </form>
    {result.status === "unreleased" && <p className="mb-4 rounded border border-line p-4 text-sm text-accent">Unreleased previews can change. Dates are source metadata, not confirmed release promises.</p>}
    <p role="status" className="mb-4 text-sm text-muted">{result.total} variants · Page {result.page} of {result.pages}</p>
    <VariantGrid items={result.items} />
    {!result.total && <EmptyState title="No variants found"><p>Try another artist or fewer filters. The catalog fills after the first successful card import.</p><Link className="mt-3 inline-block text-accent underline" href="/wiki/variants">Clear filters</Link></EmptyState>}
    <Pager label="Variant pages" base={"/wiki/variants"} sp={sp} page={result.page} pages={result.pages}/>
    <ReferenceStatus kind="cards" />
  </>;
}
