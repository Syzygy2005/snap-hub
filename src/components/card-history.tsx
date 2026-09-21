import { cardHistory } from "@/lib/wiki/card-history";
export async function CardHistory({ id }: { id: string }) {
  const { rows, url } = await cardHistory(id);
  return <section className="my-8">
    <h2 className="mb-3 text-xl font-bold">Historical card versions</h2>
    <p className="mb-4 text-sm text-muted">From <a className="text-accent underline" href={url}>SNAP.FAN’s card history</a>, refreshed daily when viewed. These are the source’s historical rows, which may include beta or temporary event versions. Missing dates stay unknown; coverage is not guaranteed complete. Current stats above come from the separate reference feed.</p>
    {rows ? <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[540px] text-left text-sm">
      <thead className="bg-surface"><tr><th className="p-3">Source date</th><th className="p-3">Cost</th><th className="p-3">Power</th><th className="p-3">Historical effect</th></tr></thead>
      <tbody>{rows.map((row,i) => <tr key={i} className="border-t border-line/50 align-top"><td className="whitespace-nowrap p-3 text-muted">{row.label}</td><td className="num p-3">{row.cost}</td><td className="num p-3">{row.power}</td><td className="p-3 leading-relaxed">{row.description || "No effect text supplied"}</td></tr>)}</tbody>
    </table></div> : <p className="rounded-lg border border-line p-4 text-sm text-muted">Historical versions are unavailable from the source right now. This does not mean the card has never changed. The current reference and official patch links remain available.</p>}
  </section>;
}
