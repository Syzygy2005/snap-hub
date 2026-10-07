import type { Metadata } from "next";
import Link from "next/link";
import { MyDecks } from "@/components/my-decks";
import { Pager } from "@/components/pager";
import { PageHeader } from "@/components/ui";
import { currentAccount } from "@/lib/auth/session";
import { discordConfig } from "@/lib/auth/discord";
import { getCards } from "@/lib/cards/queries";
import { accountDecks } from "@/lib/decks/account";
import { ownedDecks } from "@/lib/decks/queries";
import { param } from "@/lib/leaderboard/params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My decks", robots: { index: false, follow: false } };

export default async function MyDecksPage(props: PageProps<"/decks/mine">) {
  const [account, sp] = await Promise.all([currentAccount(), props.searchParams]);
  const [cards, drafts, shared] = await Promise.all([
    getCards(),
    account ? accountDecks(account.id) : Promise.resolve([]),
    account ? ownedDecks(account.id, Number(param(sp, "page") ?? "1")) : Promise.resolve({ decks: [], total: 0, page: 1, pages: 1 }),
  ]);
  return <>
    <PageHeader title="My decks" subtitle="Pick up a private draft, keep a browser deck across devices, or find a copy you shared.">
      <Link href="/decks/builder" className="rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-forest hover:bg-jade-strong">Build a deck</Link>
      <Link href="/decks" className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:text-ink">Explore decks</Link>
    </PageHeader>
    <MyDecks key={account?.id ?? "signed-out"} cards={cards} drafts={drafts} shared={shared.decks} sharedTotal={shared.total} signedIn={!!account} signInEnabled={!!discordConfig()} />
    {account && shared.pages > 1 && <>
      <p className="mt-4 text-sm text-muted">Shared copies · Page {shared.page} of {shared.pages}</p>
      <Pager base="/decks/mine" sp={sp} page={shared.page} pages={shared.pages} label="Shared copies pages" />
    </>}
  </>;
}
