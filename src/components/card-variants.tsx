import { cardVariants } from "@/lib/wiki/queries";
import type { CardVariant } from "@/lib/wiki/variants";
import { WikiArt } from "./wiki-art";
import { InteractiveArt } from "./interactive-art";

function Gallery({ items, name }: { items: CardVariant[]; name: string }) {
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
    {items.map(v => <article key={v.id} className="min-w-0 rounded-xl border border-line bg-surface/40 p-3">
      <a href={v.art} target="_blank" rel="noreferrer" aria-label={`View ${name} variant ${v.id} artwork`}>
        <InteractiveArt><WikiArt name={`${name} variant ${v.id}`} art={v.art} /></InteractiveArt>
      </a>
      <h3 className="mt-3 text-sm font-semibold">{v.artists[0]?.name || `Variant #${v.id}`}</h3>
      <p className="mt-1 text-xs text-muted">Variant {v.order || v.id}</p>
      <p className="mt-1 text-xs text-accent">{[v.rarity, v.collectorQuality].filter(Boolean).join(" · ")}</p>
      {v.artists.length > 0 && <dl className="mt-3 space-y-1 text-xs text-muted">{v.artists.map(a => <div key={a.role}><dt className="inline">{a.role}: </dt><dd className="inline">{a.name}</dd></div>)}</dl>}
      {v.releaseDate && <p className="mt-2 text-xs text-muted">Source date: <time dateTime={v.releaseDate}>{v.releaseDate}</time></p>}
    </article>)}
  </div>;
}
export async function CardVariants({ id, name }: { id: string; name: string }) {
  const variants = await cardVariants(id);
  const released = variants?.filter(v => v.status === "released") ?? [];
  const upcoming = variants?.filter(v => v.status === "unreleased") ?? [];
  return <section className="my-8" aria-labelledby="variants-heading">
    <h2 id="variants-heading" className="mb-3 text-xl font-bold">Card variants</h2>
    <p className="mb-5 text-sm leading-relaxed text-muted">Artwork and artist credits from <a href="https://marvelsnapzone.com/variants/" className="text-accent underline">Marvel Snap Zone</a>, checked hourly with the card library. Release status follows the source; released does not mean currently available in the shop.</p>
    {variants === null ? <p className="text-sm text-muted">The variant catalog is awaiting its first successful import.</p>
      : <><p className="mb-4 text-sm text-muted">{released.length} released variants</p>
        {released.length ? <Gallery items={released} name={name} /> : <p className="text-sm text-muted">No released variants listed for this card.</p>}
        {upcoming.length > 0 && <details className="mt-6 rounded-xl border border-line p-4">
          <summary className="cursor-pointer font-semibold text-accent">Unreleased variants ({upcoming.length})</summary>
          <p className="my-4 text-sm text-muted">These source-listed previews can change before release.</p>
          <Gallery items={upcoming} name={name} />
        </details>}
      </>}
  </section>;
}
