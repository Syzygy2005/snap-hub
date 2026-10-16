"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * What the person who shared a deck can do with it: move it on or off the Decks page, or delete
 * it. The route checks ownership on every call, so this is convenience rather than the boundary.
 * Deleting breaks the link for everyone who has it, which the confirmation says.
 */
export function DeckOwnerActions({ id, name, listed, buttonClass, deleteClass, afterDelete }: {
  id: string;
  name: string;
  listed: boolean;
  buttonClass: string;
  /** Its own full class list: two text colours on one element are settled by stylesheet order, not by which comes last. */
  deleteClass: string;
  /** Where to go once the deck is gone; the page it was on would be a 404. */
  afterDelete?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (init: RequestInit) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/decks/${encodeURIComponent(id)}`, init);
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "That didn't work. Try again.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    const ok = await send({ method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ listed: !listed }) });
    if (ok) router.refresh();
  };

  const remove = async () => {
    if (!confirm(`Delete the shared copy of "${name}"? Its link will stop working for everyone. Your drafts are not affected.`)) return;
    if (!(await send({ method: "DELETE" }))) return;
    if (afterDelete) router.push(afterDelete);
    else router.refresh();
  };

  return (
    <>
      <button type="button" className={buttonClass} disabled={busy} onClick={() => void toggle()}
        title={listed ? "Keep the link working but take it off the Decks page" : "Show it on the Decks page again"}>
        {listed ? "Make unlisted" : "Make public"}
      </button>
      <button type="button" className={deleteClass} disabled={busy} onClick={() => void remove()}>
        Delete shared copy
      </button>
      {error && <p role="alert" className="basis-full text-sm text-down">{error}</p>}
    </>
  );
}
