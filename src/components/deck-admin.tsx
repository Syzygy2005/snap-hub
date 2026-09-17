"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Moderation controls, shown only to an admin. The server checks again on every call, so
 * this is convenience rather than the boundary.
 *
 * Rename sits next to delete on purpose: when a deck's name is the problem, the twelve cards
 * usually are not, and taking somebody's deck away over a word is heavier than fixing the word.
 */
export function DeckAdmin({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rename = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/decks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: draft }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "Could not rename that deck");
      setRenaming(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename that deck");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/decks/${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "Could not delete that deck");
      router.push("/decks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that deck");
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-gem-purple/40 bg-gem-purple/5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-gem-purple">Admin</span>
        {renaming ? (
          <>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 40))}
              aria-label="New deck name"
              className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-1.5 text-base focus:border-accent focus:outline-none sm:text-sm"
            />
            <button
              type="button"
              onClick={rename}
              disabled={busy}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-bg hover:bg-accent-strong disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setDraft(name);
                setError(null);
              }}
              className="text-xs text-faint hover:text-ink"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:border-accent"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-md border border-down/50 px-3 py-1.5 text-sm font-medium text-down hover:bg-down/10 disabled:opacity-50"
            >
              Delete deck
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-down">{error}</p>}
    </div>
  );
}
