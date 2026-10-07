import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeckBuilderLoader } from "@/components/deck-builder-loader";
import { currentAccount } from "@/lib/auth/session";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCards } from "@/lib/cards/queries";
import { getDeck } from "@/lib/decks/queries";
import { getAccountDeck } from "@/lib/decks/account";
import { discordConfig } from "@/lib/auth/discord";
import { param } from "@/lib/leaderboard/params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Deck Builder", robots: { index: false, follow: false } };

export default async function BuilderPage(props: PageProps<"/decks/builder">) {
  const sp = await props.searchParams;
  const account = await currentAccount();
  const privateId = param(sp, "private");
  if (privateId && !account) return <>
    <PageHeader title="Private deck" subtitle="Sign in to open a draft saved to your account." />
    {discordConfig() ? <a href={`/api/auth/discord?return=${encodeURIComponent(`/decks/builder?private=${encodeURIComponent(privateId)}`)}`} className="inline-flex rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-forest">Sign in with Discord</a>
      : <p className="text-sm text-muted">Account sign-in is not available on this installation.</p>}
    <Link href="/decks/mine" className="ml-4 text-sm text-accent hover:underline">My decks</Link>
  </>;
  const [cards, saved, privateDraft] = await Promise.all([
    getCards({ deckableOnly: true }),
    !privateId && param(sp, "deck") ? getDeck(param(sp, "deck")!) : Promise.resolve(null),
    privateId && account ? getAccountDeck(account.id, privateId) : Promise.resolve(null),
  ]);
  if (privateId && !privateDraft) notFound();

  if (cards.length === 0) {
    return (
      <>
        <PageHeader title="Deck Builder" />
        <EmptyState title="Cards are still loading">
          The card list appears after the first successful reference update. Please check back shortly.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Deck Builder"
        subtitle="Click cards to add or remove them. Paste a deck code to import. Codes you copy here paste straight into Marvel Snap."
      >
        <Link href="/decks/mine" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-accent hover:bg-surface">My decks</Link>
      </PageHeader>
      <DeckBuilderLoader
        key={`${account?.id ?? "signed-out"}:${privateId ?? param(sp, "deck") ?? param(sp, "local") ?? param(sp, "code") ?? "draft"}`}
        cards={cards}
        addCard={param(sp, "add") ?? null}
        initial={saved ? { name: saved.name, defIds: saved.cards } : null}
        openAccountDeck={privateDraft}
        accountId={account?.id ?? null}
        importCode={param(sp, "code") ?? null}
        openLocalId={param(sp, "local") ?? null}
        postAs={account?.username ?? null}
        signedIn={!!account}
      />
    </>
  );
}
