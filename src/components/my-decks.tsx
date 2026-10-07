"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { Card } from "@/lib/cards/types";
import type { AccountDeck } from "@/lib/decks/account";
import type { SavedDeck } from "@/lib/decks/queries";
import { DECKS_KEY, parseLocalDecks, type LocalDeck } from "@/lib/decks/local";
import { CardArt } from "./cards";
import { RelativeTime } from "./relative-time";

function storedDecks() {
  try { return localStorage.getItem(DECKS_KEY); } catch { return null; }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
const serverDecks = () => null;
const actionClass = "inline-flex min-h-11 items-center rounded-lg border border-line px-3 py-2 text-sm font-semibold text-accent hover:bg-surface-2 disabled:opacity-50";

function DeckCard({ name, ids, byId, badge, at, children }: {
  name: string; ids: string[]; byId: Map<string, Card>; badge: string; at: string; children: React.ReactNode;
}) {
  return <li className="min-w-0 rounded-xl border border-line bg-surface p-4">
    <div className="mb-3 flex items-start justify-between gap-3">
      <h3 className="min-w-0 break-words font-display font-bold">{name}</h3>
      <span className="shrink-0 rounded border border-line px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{badge}</span>
    </div>
    <div className="grid grid-cols-6 gap-1" aria-label={`${ids.length} cards`}>
      {ids.map((id) => {
        const card = byId.get(id);
        return card ? <CardArt key={id} card={card} /> : <span key={id} className="grid aspect-square place-items-center break-all rounded bg-bg p-1 text-[10px] text-muted">{id}</span>;
      })}
    </div>
    <p className="mt-3 text-xs text-muted">{ids.length}/12 cards · <RelativeTime iso={at} /></p>
    <div className="mt-3 flex flex-wrap gap-2">{children}</div>
  </li>;
}

export function MyDecks({ cards, drafts, shared, sharedTotal, signedIn, signInEnabled }: {
  cards: Card[]; drafts: AccountDeck[]; shared: SavedDeck[]; sharedTotal: number; signedIn: boolean; signInEnabled: boolean;
}) {
  const router = useRouter();
  const raw = useSyncExternalStore(subscribe, storedDecks, serverDecks);
  const local = useMemo(() => parseLocalDecks(raw), [raw]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.defId, c])), [cards]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const saveToAccount = async (deck: LocalDeck) => {
    setBusy(deck.id); setError(""); setMessage("");
    try {
      const res = await fetch("/api/decks/private", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: deck.name, cards: deck.cards }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't save this deck to your account.");
      setCopied((previous) => ({ ...previous, [deck.id]: body.deck.id }));
      setMessage(`${deck.name} is now saved privately to your account. The browser copy is still here.`);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't save this deck. Try again."); }
    finally { setBusy(null); }
  };

  return <div className="space-y-10">
    {!signedIn && <div className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
      <p>Browser decks stay on this device. Sign in to see your private account drafts and shared copies, and save across devices.</p>
      {signInEnabled ? <a href="/api/auth/discord?return=%2Fdecks%2Fmine" className={`${actionClass} mt-3`}>Sign in with Discord</a>
        : <p className="mt-2">Account sign-in is not available on this installation.</p>}
    </div>}
    {error && <p role="alert" className="rounded-lg border border-down/40 bg-down/10 p-3 text-sm text-down">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">{message}</p>}

    <section aria-labelledby="account-drafts-title">
      <h2 id="account-drafts-title" className="font-display text-xl font-bold">Private account drafts{signedIn && ` · ${drafts.length}`}</h2>
      <p className="mb-4 mt-1 text-sm text-muted">Only you can open these. Available wherever you sign in.</p>
      {drafts.length ? <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{drafts.map((d) => <DeckCard key={d.id} name={d.name} ids={d.cards} byId={byId} badge="Private" at={d.updatedAt}>
        <Link href={`/decks/builder?private=${encodeURIComponent(d.id)}`} className={actionClass}>Edit private draft</Link>
      </DeckCard>)}</ul> : <p className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">{signedIn ? "No account drafts yet. Save one from the builder or copy a browser deck below." : "Sign in to load your account drafts."}</p>}
    </section>

    <section aria-labelledby="browser-drafts-title">
      <h2 id="browser-drafts-title" className="font-display text-xl font-bold">In this browser · {local.length}</h2>
      <p className="mb-4 mt-1 text-sm text-muted">Stored on this device. Saving to your account creates a private copy and keeps this one.</p>
      {local.length ? <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{local.map((d) => <DeckCard key={d.id} name={d.name} ids={d.cards} byId={byId} badge="Browser" at={d.updatedAt}>
        <Link href={`/decks/builder?local=${encodeURIComponent(d.id)}`} className={actionClass}>Edit browser draft</Link>
        {signedIn && (copied[d.id] ? <Link href={`/decks/builder?private=${encodeURIComponent(copied[d.id])}`} className={actionClass}>Open account copy</Link>
          : <button type="button" className={actionClass} disabled={busy !== null || !d.cards.length} onClick={() => void saveToAccount(d)}>{busy === d.id ? "Saving…" : "Save to account"}</button>)}
      </DeckCard>)}</ul> : <p className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">No decks saved in this browser. Use Save to browser in the builder to keep one here.</p>}
    </section>

    <section aria-labelledby="shared-copies-title">
      <h2 id="shared-copies-title" className="font-display text-xl font-bold">Shared copies{signedIn && ` · ${sharedTotal}`}</h2>
      <p className="mb-4 mt-1 text-sm text-muted">Public copies appear in Explore decks. Unlisted copies are accessible to anyone with their link. Editing a private draft does not update a shared copy.</p>
      {shared.length ? <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{shared.map((d) => <DeckCard key={d.id} name={d.name} ids={d.cards} byId={byId} badge={d.listed ? "Public" : "Unlisted"} at={d.createdAt}>
        <Link href={`/decks/${d.id}`} className={actionClass}>Open shared copy</Link>
        <Link href={`/decks/builder?deck=${d.id}`} className={actionClass}>Edit a new copy</Link>
      </DeckCard>)}</ul> : <p className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">{signedIn ? "No shared copies on your account. Sharing a deck is a separate action in the builder." : "Sign in to see copies shared from your account."}</p>}
    </section>
  </div>;
}
