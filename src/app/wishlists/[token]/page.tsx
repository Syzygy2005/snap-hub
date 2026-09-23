import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { sharedWishlist } from "@/lib/wiki/collection";
import { PageHeader } from "@/components/ui";
import { VariantGrid } from "@/components/variant-grid";
import { pageHref, value } from "@/lib/wiki/filter";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Shared variant wishlist",robots:{index:false,follow:false}};
export default async function WishlistPage(props:PageProps<"/wishlists/[token]">) {
  const {token}=await props.params,wishlist=await sharedWishlist(token);if(!wishlist)notFound();
  const sp=await props.searchParams,pages=Math.max(1,Math.ceil(wishlist.items.length/36)),requested=Number(value(sp,"page")),page=Math.min(pages,Math.max(1,Number.isFinite(requested)?Math.floor(requested):1));
  const items=wishlist.items.slice((page-1)*36,page*36),base=`/wishlists/${token}`;
  return <><PageHeader title={`${wishlist.username}’s wishlist`} subtitle="Artwork they would love to collect. Availability and release details follow the source catalog."/><p className="mb-5 text-sm text-muted">{wishlist.items.length} wanted variants · Page {page} of {pages}</p><VariantGrid controls={false} items={items.flatMap(v=>v.variant?[{card_id:v.card_id,card_name:v.card_name,variant:v.variant}]:[])}/>{items.filter(v=>!v.variant).map(v=><p key={`${v.card_id}:${v.variant_id}`} className="my-4 text-sm text-muted">{v.card_name} · Variant {v.variant_id} (no longer listed)</p>)}{!wishlist.items.length&&<p>No wanted variants saved yet.</p>}<nav aria-label="Wishlist pages" className="my-8 flex justify-between text-sm text-accent">{page>1?<Link href={pageHref(base,sp,page-1)}>← Previous</Link>:<span/>}{page<pages&&<Link href={pageHref(base,sp,page+1)}>Next →</Link>}</nav><Link className="mt-6 inline-block text-accent underline" href="/wiki/variants">Explore the variant gallery →</Link></>;
}
