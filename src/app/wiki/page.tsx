import { PageHeader } from "@/components/ui";
import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Card & Location Wiki", alternates: { canonical: "/wiki" }, description: "Explore MARVEL SNAP cards and locations, with automatically refreshed stats and effects." };
export default function WikiPage() { return <>
  <PageHeader title="Know your next move." subtitle="Every card. Every location. Explore the latest available stats and effects, then take your discoveries into the deck builder." />
  <div className="grid gap-5 sm:grid-cols-2">{[["cards","Card library","Search energy, power, abilities and series."],["locations","Location atlas","Explore effects and source-reported rarity."]].map(([id,title,text]) => <Link key={id} className="brand-tile rounded-xl border border-line bg-surface p-8" href={`/wiki/${id}`}><h2 className="font-display text-2xl font-bold">{title} <span className="text-accent">→</span></h2><p className="mt-3 text-muted">{text}</p></Link>)}</div>
  <p className="mt-8 text-sm text-muted">Reference first. Strategy and interaction guides will follow. Updates are checked hourly; source publication and scheduler delays can affect freshness.</p>
</>; }
