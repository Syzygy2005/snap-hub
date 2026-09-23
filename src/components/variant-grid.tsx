import Link from "next/link";
import { WikiArt } from "./wiki-art";
import { VariantActions } from "./variant-tools";
import { artistHref, variantHref } from "@/lib/wiki/variant-key";
import type { VariantEntry } from "@/lib/wiki/variant-browser";
export function VariantGrid({items,anchors=false,controls=true}: {items:VariantEntry[];anchors?:boolean;controls?:boolean}) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{items.map(({card_id,card_name,variant:v})=><article key={`${card_id}:${v.id}`} id={anchors?`variant-${encodeURIComponent(v.id)}`:undefined} className="min-w-0 scroll-mt-48 rounded-xl border border-line bg-surface/40 p-3">
    <a href={v.art} target="_blank" rel="noreferrer" aria-label={`View ${card_name} variant ${v.id} artwork`}><WikiArt name={`${card_name} variant ${v.id}`} art={v.art}/></a>
    <h3 className="mt-3 text-sm font-bold"><Link className="hover:text-accent" href={v.status==="released"?variantHref(card_id,v.id):`/wiki/cards/${encodeURIComponent(card_id)}`}>{card_name}</Link></h3>
    <p className="mt-1 text-xs text-muted">Variant {v.order || v.id}</p>
    <p className="mt-1 text-xs text-accent">{[v.rarity,v.collectorQuality].filter(Boolean).join(" · ") || "Category not listed"}</p>
    {v.status==="unreleased" && <p className="mt-2 text-xs text-accent">Unreleased preview</p>}
    <dl className="mt-3 space-y-1 break-words text-xs text-muted">{v.artists.map(a=><div key={a.role}><dt className="inline">{a.role}: </dt><dd className="inline"><Link className="underline hover:text-accent" href={artistHref(a.name)}>{a.name}</Link></dd></div>)}</dl>
    {!v.artists.length && <p className="mt-3 text-xs text-muted">Artist not listed</p>}
    {v.releaseDate && <p className="mt-2 text-xs text-muted">Source date: <time dateTime={v.releaseDate}>{v.releaseDate}</time></p>}
    {controls && <VariantActions card={card_id} id={v.id} name={card_name} preview={v.status==="unreleased"}/>}
  </article>)}</div>;
}
