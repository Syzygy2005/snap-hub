import type { Metadata } from "next";
import Link from "next/link";
import { findVariant } from "@/lib/wiki/variant-browser";
import { parseVariantKey } from "@/lib/wiki/variant-key";
import { value } from "@/lib/wiki/filter";
import { VariantGrid } from "@/components/variant-grid";
import { PageHeader } from "@/components/ui";
import { CopyComparison } from "@/components/variant-tools";
export const metadata:Metadata={title:"Compare variant artwork",robots:{index:false,follow:true}};
export default async function ComparePage(props:PageProps<"/wiki/compare">) {
  const sp=await props.searchParams,keys=[value(sp,"a"),value(sp,"b")];
  const items=await Promise.all(keys.map(async key=>{const pair=parseVariantKey(key);return pair?findVariant(...pair):null;}));
  return <><PageHeader title="See them side by side." subtitle="Compare artwork, artist credits and source categories. Open either image to inspect the full artwork."/>{items.every(Boolean)&&keys[0]!==keys[1]?<><CopyComparison/><div className="grid grid-cols-2 gap-3 sm:gap-6">{items.map((item,i)=><div key={keys[i]} className="min-w-0 [&>div]:grid-cols-1"><VariantGrid items={item?[item]:[]}/></div>)}</div></>:<p className="rounded-xl border border-line p-6 text-muted">Choose two different variants in the gallery. A saved comparison may be unavailable if its artwork has left the catalog.</p>}<Link href="/wiki/variants" className="my-6 inline-block text-accent underline">Choose variants →</Link></>;
}
