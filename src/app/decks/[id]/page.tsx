import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AbilityText, CardArt, EnergyCurve } from "@/components/cards";
import { CopyButton } from "@/components/deck-actions";
import { RelativeTime } from "@/components/relative-time";
import { PageHeader, Panel } from "@/components/ui";
import { getCards } from "@/lib/cards/queries";
import type { Card } from "@/lib/cards/types";
import { encodeDeck, gameClipboardText } from "@/lib/decks/code";
import { getDeck } from "@/lib/decks/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/decks/[id]">): Promise<Metadata> {
  const deck = await getDeck((await props.params).id);
  return { title: deck ? deck.name : "Deck not found" };
}

export default async function DeckPage(props: PageProps<"/decks/[id]">) {
  const { id } = await props.params;
  const [deck, allCards] = await Promise.all([getDeck(id, true), getCards()]);
  if (!deck) notFound();

  const byId = new Map(allCards.map((c) => [c.defId, c]));
  const cards = deck.cards
    .map((defId) => byId.get(defId))
    .filter((c): c is Card => !!c)
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const code = encodeDeck(cards.map((c) => c.defId), deck.name);
  const avgCost = cards.reduce((s, c) => s + c.cost, 0) / (cards.length || 1);

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/decks" className="text-muted hover:text-ink">
          ← Decks
        </Link>
      </div>
      <PageHeader
        title={deck.name}
        subtitle={
          <>
            Shared <RelativeTime iso={deck.createdAt} /> · {deck.views.toLocaleString()} view{deck.views === 1 ? "" : "s"} · avg
            cost {avgCost.toFixed(1)}
            {!deck.listed && (
              <span
                title="Kept off the Decks page. Anyone with this link can open it."
                className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted"
              >
                Unlisted
              </span>
            )}
          </>
        }
      >
        <CopyButton text={code} label="Copy deck code" primary />
        <CopyButton text={gameClipboardText(cards, deck.name)} label="Copy with card list" />
        <Link
          href={`/decks/builder?deck=${deck.id}`}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:text-ink"
        >
          Edit a copy
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <li key={c.defId} className="rounded-xl border border-line bg-surface/80 p-2">
              <CardArt card={c} eager />
              <div className="mt-1 px-1">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-muted">
                  <AbilityText text={c.ability} />
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-4">
          <Panel title="Energy curve">
            <div className="p-4">
              <EnergyCurve cards={cards} />
            </div>
          </Panel>
          <Panel title="Deck code">
            <div className="p-4">
              <textarea
                readOnly
                value={code}
                rows={5}
                aria-label="Deck code"
                className="w-full resize-none rounded-lg border border-line bg-bg p-2 font-mono text-base text-muted sm:text-[11px]"
              />
              <p className="mt-2 text-xs text-faint">In Marvel Snap, open the deck editor and paste to import.</p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
