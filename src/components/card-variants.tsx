import { cardVariants } from "@/lib/wiki/queries";
import { VariantGrid } from "./variant-grid";
import Link from "next/link";

export async function CardVariants({ id, name }: { id: string; name: string }) {
  // One section of the card page. If the catalog read fails, say so here rather than letting the
  // error reach the page's boundary and replace the card's stats with an error screen.
  let variants: Awaited<ReturnType<typeof cardVariants>>;
  try {
    variants = await cardVariants(id);
  } catch (error) {
    console.error("Card variants unavailable", error);
    return <section className="my-8" aria-labelledby="variants-heading"><h2 id="variants-heading" className="mb-3 text-xl font-bold">Card variants</h2><p className="text-sm text-muted">Variants couldn’t be loaded right now. The rest of this page is unaffected.</p></section>;
  }
  const released = variants?.filter(v => v.status === "released") ?? [];
  const upcoming = variants?.filter(v => v.status === "unreleased") ?? [];
  return <section className="my-8" aria-labelledby="variants-heading">
    <h2 id="variants-heading" className="mb-3 text-xl font-bold">Card variants</h2>
    <Link className="mb-3 inline-block text-sm text-accent underline" href={`/wiki/variants?${new URLSearchParams({card:id})}`}>Browse this card in the variant gallery →</Link>
    <p className="mb-5 text-sm leading-relaxed text-muted">Artwork and artist credits from <a href="https://marvelsnapzone.com/variants/" className="text-accent underline">Marvel Snap Zone</a>, checked hourly with the card library. Release status follows the source; released does not mean currently available in the shop.</p>
    {variants === null ? <p className="text-sm text-muted">The variant catalog is awaiting its first successful import.</p>
      : <><p className="mb-4 text-sm text-muted">{released.length} released variants</p>
        {released.length ? <VariantGrid anchors items={released.map(variant=>({card_id:id,card_name:name,variant}))} /> : <p className="text-sm text-muted">No released variants listed for this card.</p>}
        {upcoming.length > 0 && <details className="mt-6 rounded-xl border border-line p-4">
          <summary className="cursor-pointer font-semibold text-accent">Unreleased variants ({upcoming.length})</summary>
          <p className="my-4 text-sm text-muted">These source-listed previews can change before release.</p>
          <VariantGrid anchors items={upcoming.map(variant=>({card_id:id,card_name:name,variant}))} />
        </details>}
      </>}
  </section>;
}
