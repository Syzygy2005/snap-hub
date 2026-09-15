import type { Metadata } from "next";
import Link from "next/link";
import { CardArt } from "@/components/cards";
import { RelativeTime } from "@/components/relative-time";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCards } from "@/lib/cards/queries";
import type { Card } from "@/lib/cards/types";
import { listDecks } from "@/lib/decks/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Decks" };

export default async function DecksPage() {
  const [decks, allCards] = await Promise.all([listDecks(), getCards()]);
  const byId = new Map(allCards.map((c) => [c.defId, c]));

  return (
    <>
      <PageHeader title="Decks" subtitle="Recently shared decks.">
        <Link href="/decks/builder" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-strong">
          Build a deck
        </Link>
      </PageHeader>

      {decks.length === 0 ? (
        <EmptyState title="No decks shared yet">
          Build one in the <Link href="/decks/builder" className="text-accent hover:underline">deck builder</Link> and
          press Share link.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {decks.map((d) => {
            const cards = d.cards
              .map((id) => byId.get(id))
              .filter((c): c is Card => !!c)
              .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
            const avg = cards.reduce((s, c) => s + c.cost, 0) / (cards.length || 1);
            return (
              <li key={d.id}>
                <Link
                  href={`/decks/${d.id}`}
                  className="block rounded-xl border border-line bg-surface/80 p-3 transition-colors hover:border-accent/60"
                >
                  <div className="grid grid-cols-6 gap-1">
                    {cards.map((c) => (
                      <CardArt key={c.defId} card={c} />
                    ))}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="truncate font-display text-sm font-bold uppercase tracking-wide">{d.name}</span>
                    <span className="num shrink-0 text-xs text-muted">avg {avg.toFixed(1)}</span>
                  </div>
                  <div className="text-xs text-faint">
                    <RelativeTime iso={d.createdAt} /> · {d.views} view{d.views === 1 ? "" : "s"}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
