import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { PATCH_ARCHIVE } from "@/lib/wiki/patches";
export const metadata: Metadata = { title: "Official patch archive", alternates: { canonical: "/wiki/history" } };
export default function PatchArchive() {
  return <>
    <PageHeader title="Official patch archive" subtitle="Explore the published updates behind the cards and locations." />
    <aside className="mb-6 rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed text-muted">
      <p>{PATCH_ARCHIVE.articleCount} official patch and balance articles indexed on {PATCH_ARCHIVE.indexedAt.slice(0,10)}. Card and location pages link to articles that mention them.</p>
      <p className="mt-2">This is a source index, not a complete list of every historical change. Mentions may concern balance, bug fixes, or discussion. Patch dates come from explicit article titles or URLs. RSS publication dates are labeled separately; they may differ from the effective patch date. Old articles do not describe the current game state.</p>
      <p className="mt-2">For additional card timelines, visit <a className="text-accent underline" href="https://snap.fan/cards/history/2026/">SNAP.FAN’s card history</a> or <a className="text-accent underline" href="https://marvelsnapzone.com/card-history/?past=all">Marvel Snap Zone’s archive</a>. For newer notes, check <a className="text-accent underline" href="https://marvelsnap.com/news/">official news</a>.</p>
    </aside>
    <div className="space-y-3">{PATCH_ARCHIVE.notes.map(note => <article key={note.url} className="rounded-xl border border-line bg-surface/50 p-4">
      <p className="text-xs text-muted">{note.date ? <time dateTime={note.date}>{note.date}</time> : note.publishedAt ? `Published ${note.publishedAt}` : "Date not confirmed"}</p>
      <h2 className="mt-1 font-semibold"><a href={note.url} className="text-accent hover:underline">{note.title} ↗</a></h2>
      <p className="mt-2 text-xs text-muted">Official MARVEL SNAP article · {note.mentions.length} reference entries mentioned</p>
    </article>)}</div>
    <Link href="/wiki" className="mt-8 inline-block text-accent underline">Back to the wiki</Link>
  </>;
}
