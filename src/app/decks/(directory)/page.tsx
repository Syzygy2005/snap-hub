import type { Metadata } from "next";
import Link from "next/link";
import { DeckDirectory } from "@/components/deck-directory";
import { PageHeader } from "@/components/ui";
import { getCards } from "@/lib/cards/queries";
import { listDecks } from "@/lib/decks/queries";
import { param, paramList } from "@/lib/leaderboard/params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Decks" };

export default async function DecksPage(props: PageProps<"/decks">) {
  const sp = await props.searchParams;
  const q = param(sp, "q")?.trim() ?? "";
  const selected = paramList(sp, "card");

  const [decks, allCards] = await Promise.all([listDecks({ q, cards: selected }), getCards()]);

  return (
    <>
      <PageHeader title="Decks" subtitle="Decks people have shared, plus the ones saved in this browser.">
        <Link href="/decks/builder" className="rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-forest hover:bg-jade-strong">
          Build a deck
        </Link>
      </PageHeader>

      <DeckDirectory decks={decks} cards={allCards} q={q} selected={selected} />
    </>
  );
}
