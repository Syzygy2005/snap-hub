import type { Metadata } from "next";
import Link from "next/link";
import { currentAccount } from "@/lib/auth/session";
import { discordConfig } from "@/lib/auth/discord";
import { collection, shareToken } from "@/lib/wiki/collection";
import { VariantGrid } from "@/components/variant-grid";
import { VariantActions } from "@/components/variant-tools";
import { WishlistSharing } from "@/components/wishlist-sharing";
import { EmptyState, PageHeader } from "@/components/ui";
import { pageHref, value } from "@/lib/wiki/filter";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"My variant collection",robots:{index:false,follow:false}};
export default async function CollectionPage(props:PageProps<"/wiki/my-collection">) {
  const account=await currentAccount();
  if(!account)return <><PageHeader title="Your collection, your taste." subtitle="Keep track of artwork you own and variants you want next."/>{discordConfig()?<a href="/api/auth/discord?return=%2Fwiki%2Fmy-collection" className="inline-block rounded bg-accent px-5 py-3 font-bold text-bg">Sign in with Discord</a>:<p>Collection sign-in is not available on this installation.</p>}<p className="mt-4 text-sm text-muted">Your collection is private until you choose to share a wishlist.</p></>;
  const sp=await props.searchParams,all=await collection(account.id),filter=value(sp,"status"),q=value(sp,"q").trim().slice(0,100).toLowerCase();
  const items=all.filter(v=>(!["owned","wanted"].includes(filter)||v.status===filter)&&`${v.card_name} ${v.variant?.artists.map(a=>a.name).join(" ") ?? ""}`.toLowerCase().includes(q));
  const pages=Math.max(1,Math.ceil(items.length/36)),requested=Number(value(sp,"page")),page=Math.min(pages,Math.max(1,Number.isFinite(requested)?Math.floor(requested):1)),visible=items.slice((page-1)*36,page*36);
  return <><PageHeader title="My variant collection" subtitle="A manual checklist of your artwork. Changes here do not change your in-game collection."/>
    <p className="mb-5 text-sm text-muted">{all.filter(v=>v.status==="owned").length} owned · {all.filter(v=>v.status==="wanted").length} wanted · <Link href="/wiki/variants" className="text-accent underline">Find more artwork →</Link></p>
    <WishlistSharing initialToken={await shareToken(account.id)}/>
    <form key={JSON.stringify(sp)} className="mb-6 flex flex-wrap gap-3" action="/wiki/my-collection"><label className="text-sm">Search collection<input name="q" type="search" maxLength={100} defaultValue={value(sp,"q")} className="mt-1 block rounded border border-line bg-bg p-2"/></label><label className="text-sm">Show<select name="status" defaultValue={filter} className="mt-1 block rounded border border-line bg-bg p-2"><option value="">All saved variants</option><option value="owned">Owned</option><option value="wanted">Wanted</option></select></label><button className="self-end rounded bg-accent px-4 py-2 font-bold text-bg">Apply filters</button></form>
    <p className="mb-4 text-sm text-muted">{items.length} variants · Page {page} of {pages}</p>
    <VariantGrid items={visible.flatMap(v=>v.variant?[{card_id:v.card_id,card_name:v.card_name,variant:v.variant}]:[])}/>
    {visible.filter(v=>!v.variant).map(v=><article key={`${v.card_id}:${v.variant_id}`} className="my-3 rounded border border-line p-4"><h3>{v.card_name} · Variant {v.variant_id}</h3><p className="text-sm text-muted">Saved as {v.status}. No longer listed in the source catalog.</p><VariantActions missing card={v.card_id} id={v.variant_id} name={v.card_name}/></article>)}
    {!items.length&&<EmptyState title="No saved variants here"><p>Use Owned or Wanted on any variant in the gallery to start your collection.</p><Link className="text-accent underline" href="/wiki/variants">Browse variants</Link></EmptyState>}
    <nav aria-label="Collection pages" className="my-8 flex justify-between text-sm text-accent">{page>1?<Link href={pageHref("/wiki/my-collection",sp,page-1)}>← Previous</Link>:<span/>}{page<pages&&<Link href={pageHref("/wiki/my-collection",sp,page+1)}>Next →</Link>}</nav>
  </>;
}
