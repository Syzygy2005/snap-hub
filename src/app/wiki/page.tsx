import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Card & Location Wiki", alternates: { canonical: "/wiki" }, description: "Explore MARVEL SNAP cards and locations, with automatically refreshed stats and effects." };
export default function WikiPage() { return <>
  <div className="bg-surface mb-8 rounded-xl border border-line p-6 sm:p-10"><p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-accent">The reference desk</p><h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">Know your next move.</h1><p className="mt-4 max-w-xl leading-relaxed text-muted">Every card. Every location. Explore the latest available stats and effects, then take your discoveries into the deck builder.</p></div>
  <div className="grid gap-5 sm:grid-cols-2">{[["cards","Card library","Search energy, power, abilities and series."],["locations","Location atlas","Explore effects and source-reported rarity."]].map(([id,title,text]) => <Link key={id} className="brand-tile rounded-xl border border-line bg-surface p-8" href={`/wiki/${id}`}><h2 className="font-display text-2xl font-bold">{title} <span className="text-accent">→</span></h2><p className="mt-3 text-muted">{text}</p></Link>)}</div>
  <p className="mt-8 text-sm text-muted">Reference first. Strategy and interaction guides will follow. Updates are checked hourly; source publication and scheduler delays can affect freshness.</p>
</>; }
