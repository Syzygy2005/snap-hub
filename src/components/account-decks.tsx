"use client";

import { useEffect, useState } from "react";
import type { AccountDeck } from "@/lib/decks/account";

export function AccountDecks({ signedIn, name, cards, onLoad }: {
  signedIn: boolean; name: string; cards: string[]; onLoad: (deck: AccountDeck) => void;
}) {
  const [decks, setDecks] = useState<AccountDeck[]>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    const ctrl = new AbortController();
    fetch("/api/decks/private", { signal: ctrl.signal }).then(async (res) => {
      if (!res.ok) throw new Error("Couldn't load your account decks.");
      const body = await res.json();
      setDecks(body.decks);
      setError("");
    }).catch(() => { if (!ctrl.signal.aborted) setError("Couldn't load your account decks. Try refreshing the list."); });
    return () => ctrl.abort();
  }, [signedIn, reload]);

  const save = async (id?: string) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/decks/private", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name, cards }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't save deck.");
      setDecks((items) => [body.deck, ...items.filter((d) => d.id !== body.deck.id)]);
      setSelected(body.deck.id);
      setMessage("Saved privately to your account. Available on your other devices.");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't save deck."); }
    finally { setBusy(false); }
  };

  return (
    <section className="col-span-2 space-y-3 rounded-lg border border-line p-3" aria-label="Private account decks">
      <h3 className="font-semibold">Private account decks</h3>
      <p className="text-xs text-muted">Only you can access these. Sharing a public or unlisted copy is a separate action above.</p>
      {!signedIn ? <p className="text-sm text-muted">Sign in to save decks across devices. Browser saves still work below.</p> : <>
        {error && <p role="alert" className="text-sm text-down">{error}</p>}
        {message && <p role="status" className="text-sm text-up">{message}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !cards.length} onClick={() => void save()} className="rounded border border-line px-3 py-2 text-sm disabled:opacity-40">Save new private deck</button>
          {selected && <button type="button" disabled={busy || !cards.length} onClick={() => void save(selected)} className="rounded border border-line px-3 py-2 text-sm disabled:opacity-40">Update selected deck</button>}
          <button type="button" disabled={busy} onClick={() => setReload((n) => n + 1)} className="text-xs text-accent">Refresh account decks</button>
        </div>
        {selected && <p className="text-xs text-muted">Updating: {decks.find((d) => d.id === selected)?.name}</p>}
        <ul className="space-y-2">{decks.map((d) => <li key={d.id} className="flex items-center gap-2">
          <button type="button" disabled={busy} onClick={() => {
            if (cards.length && !confirm("Replace the current builder with this saved deck?")) return;
            setSelected(d.id); onLoad(d); setMessage("");
          }} className="min-w-0 flex-1 truncate text-left text-sm text-accent">{d.name} · {d.cards.length}/12</button>
          <button type="button" disabled={busy} aria-label={`Delete private deck ${d.name}`} className="text-xs text-down" onClick={async () => {
            if (!confirm(`Delete private deck “${d.name}” from your account?`)) return;
            setBusy(true); setError("");
            try {
              const res = await fetch(`/api/decks/private?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
              if (!res.ok) throw new Error("Couldn't delete deck.");
              setDecks((items) => items.filter((item) => item.id !== d.id));
              if (selected === d.id) setSelected(undefined);
              setMessage("Private deck deleted.");
            } catch { setError("Couldn't delete deck. Try again."); }
            finally { setBusy(false); }
          }}>Delete</button>
        </li>)}</ul>
      </>}
    </section>
  );
}
