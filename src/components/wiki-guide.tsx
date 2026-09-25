import Link from "next/link";
import { PageHeader } from "./ui";
import { ScrollToHash } from "./scroll-to-hash";
import type { WikiGuide as Guide } from "@/lib/wiki/guides";

export function WikiGuide({ guide }: { guide: Guide }) {
  return <>
    <PageHeader title={guide.title} subtitle={guide.summary} />
    <p className="mb-6 text-xs text-muted">Reviewed <time dateTime={guide.reviewed}>{guide.reviewed}</time> · Written by Snap Hub. Rules and event formats can change.</p>
    <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="On this page" className="rounded-xl border border-line bg-surface/50 p-5">
        <h2 className="mb-3 text-sm font-bold">On this page</h2>
        <ul className="space-y-2 text-sm text-muted">{guide.sections.map(s => <li key={s.id}><a href={`#${s.id}`} className="hover:text-accent hover:underline">{s.title}</a></li>)}</ul>
      </nav>
      <div className="min-w-0 space-y-5">{guide.sections.map(s => <section id={s.id} key={s.id} className="scroll-mt-48 rounded-xl border border-line bg-surface/30 p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">{s.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{s.text}</p>
        {s.source && <a href={s.source.url} className="mt-3 inline-block text-xs text-accent underline">{s.source.title} ↗</a>}
      </section>)}</div>
    </div>
    <section className="mt-8"><h2 className="mb-3 text-lg font-bold">Keep exploring</h2><div className="flex flex-wrap gap-3">{guide.related.map(l => <Link key={l.href} href={l.href} className="brand-tile rounded-lg border border-line bg-surface px-4 py-3 text-sm text-accent">{l.title} →</Link>)}</div></section>
    <ScrollToHash key={guide.slug} prefix="" />
  </>;
}
