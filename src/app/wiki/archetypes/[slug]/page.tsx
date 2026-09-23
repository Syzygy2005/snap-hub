import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { archetypeBySlug,ARCHETYPES } from "@/lib/wiki/archetypes";
import { entry } from "@/lib/wiki/queries";
import { PageHeader } from "@/components/ui";
import { WikiArt } from "@/components/wiki-art";
import { AbilityText } from "@/components/cards";
export async function generateMetadata(props:PageProps<"/wiki/archetypes/[slug]">):Promise<Metadata>{const {slug}=await props.params,a=archetypeBySlug(slug);return {title:a?`${a.title} deck guide`:"Archetype guide",alternates:{canonical:`/wiki/archetypes/${slug}`}};}
export default async function ArchetypePage(props:PageProps<"/wiki/archetypes/[slug]">){
  const {slug}=await props.params,a=archetypeBySlug(slug);if(!a)notFound();
  const cards=await Promise.all(a.cards.map(async c=>({...c,entry:await entry("cards",c.id)})));
  return <><PageHeader title={`${a.title}: learn the game plan`} subtitle={a.summary}/><p className="mb-7 text-xs text-muted">Editorial guide · Reviewed September 22, 2026 · Illustrative core roles, not a complete deck or current tier ranking.</p>
    <h2 className="mb-4 text-xl font-bold">Core cards and roles</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(c=><article key={c.id} className="rounded-xl border border-line bg-surface p-4">{c.entry&&<Link href={`/wiki/cards/${encodeURIComponent(c.id)}`}><WikiArt name={c.name} art={c.entry.art}/></Link>}<h3 className="mt-3 font-bold"><Link className="text-accent underline" href={c.entry?`/wiki/cards/${encodeURIComponent(c.id)}`:`/wiki/cards?${new URLSearchParams({q:c.name})}`}>{c.name}</Link></h3><p className="mt-2 text-xs text-accent">{c.role}</p><p className="mt-3 text-sm text-muted">{c.entry?<AbilityText text={c.entry.ability}/>:"Reference details will appear after the card catalog is imported."}</p></article>)}</div>
    <section className="my-8"><h2 className="mb-4 text-xl font-bold">Your game plan</h2><div className="grid gap-4 md:grid-cols-3">{a.plan.map((text,i)=><article key={i} className="rounded-xl border border-line p-5"><h3 className="font-bold text-accent">{["Early turns","Build the engine","Find the finish"][i]}</h3><p className="mt-3 text-sm leading-relaxed text-muted">{text}</p></article>)}</div></section>
    <div className="grid gap-6 md:grid-cols-2"><section className="rounded-xl border border-line bg-surface/50 p-5"><h2 className="text-xl font-bold">Missing a card?</h2>{a.substitutions.map(t=><p key={t} className="mt-4 text-sm leading-relaxed text-muted">{t}</p>)}</section><section className="rounded-xl border border-line p-5"><h2 className="text-xl font-bold">Common mistakes</h2><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-muted">{a.mistakes.map(t=><li key={t}>{t}</li>)}</ul></section></div>
    <section className="my-8 rounded-xl border border-line p-5"><h2 className="font-bold">Try the plan</h2><p className="my-3 text-sm text-muted">Build around the cards you own. Check live effects, then compare public decks before committing resources.</p><div className="flex flex-wrap gap-4 text-sm text-accent"><Link className="underline" href="/decks/builder">Open deck builder</Link><Link className="underline" href={`/decks?${new URLSearchParams({q:a.title})}`}>Explore public decks</Link><Link className="underline" href={`/wiki/locations?${new URLSearchParams({q:a.mechanic})}`}>Locations mentioning this mechanic</Link><Link className="underline" href="/wiki/interactions">Practice the rules</Link></div></section>
    <p className="text-xs leading-relaxed text-muted">Current card text and artwork: <a className="underline" href="https://marvelsnapzone.com/cards/">Marvel Snap Zone</a>. Strategy paragraphs are Snap Hub editorial guidance. Balance changes can alter these roles; consult each card’s reference and patch history.</p>
    <nav aria-label="Other archetypes" className="my-7 flex flex-wrap gap-4 text-sm text-accent">{ARCHETYPES.filter(other=>other.slug!==slug).map(other=><Link key={other.slug} href={`/wiki/archetypes/${other.slug}`}>{other.title} →</Link>)}</nav>
  </>;
}
