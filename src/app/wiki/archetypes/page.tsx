import Link from "next/link";
import type { Metadata } from "next";
import { ARCHETYPES } from "@/lib/wiki/archetypes";
import { PageHeader } from "@/components/ui";
export const metadata:Metadata={title:"Deck archetype guides",alternates:{canonical:"/wiki/archetypes"}};
export default function ArchetypesPage(){return <><PageHeader title="Find your kind of deck." subtitle="Six foundations for understanding how a deck wins, what its pieces do and how to adapt it to your collection."/><p className="mb-6 text-sm text-muted">These are learning guides, not a live tier list. Card links show the current imported text. Reviewed September 22, 2026.</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{ARCHETYPES.map((a,i)=><Link key={a.slug} href={`/wiki/archetypes/${a.slug}`} className="brand-tile rounded-xl border border-line bg-surface p-6"><span className="font-display text-4xl font-bold text-accent/40">0{i+1}</span><h2 className="mt-4 font-display text-2xl font-bold">{a.title} →</h2><p className="mt-3 text-sm leading-relaxed text-muted">{a.summary}</p><p className="mt-5 text-xs text-accent">Core roles · Game plan · Substitutions</p></Link>)}</div></>;}
