import type { Metadata } from "next";
import { DeckBuilderLoader } from "@/components/deck-builder-loader";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCards } from "@/lib/cards/queries";
import { getDeck } from "@/lib/decks/queries";
import { param } from "@/lib/leaderboard/params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Deck Builder" };

export default async function BuilderPage(props: PageProps<"/decks/builder">) {
  const sp = await props.searchParams;
  const [cards, saved] = await Promise.all([
    getCards({ deckableOnly: true }),
    param(sp, "deck") ? getDeck(param(sp, "deck")!) : Promise.resolve(null),
  ]);

  if (cards.length === 0) {
    return (
      <>
        <PageHeader title="Deck Builder" />
        <EmptyState title="Cards are still loading">
          The card list syncs with the first snapshot after the server starts. Refresh in a few seconds.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Deck Builder"
        subtitle="Click cards to add or remove them. Paste a deck code to import. Codes you copy here paste straight into Marvel Snap."
      />
      <DeckBuilderLoader
        cards={cards}
        initial={saved ? { name: saved.name, defIds: saved.cards } : null}
        importCode={param(sp, "code") ?? null}
        openLocalId={param(sp, "local") ?? null}
      />
    </>
  );
}
