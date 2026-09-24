"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KIND_LABELS, NEWS_KINDS, type NewsItem, type NewsKind } from "@/lib/news/types";

interface Draft {
  kind: NewsKind;
  title: string;
  body: string;
  sourceUrl: string;
  publishedAt: string;
}

/** A datetime-local value in the browser's own zone, which is the zone the typist is thinking in. */
function localInputValue(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const blank = (): Draft => ({ kind: "balance", title: "", body: "", sourceUrl: "", publishedAt: localInputValue() });

const fromItem = (item: NewsItem): Draft => ({
  kind: item.kind,
  title: item.title,
  body: item.body,
  sourceUrl: item.sourceUrl ?? "",
  publishedAt: localInputValue(item.publishedAt),
});

/**
 * Posting and editing game news, shown only to an admin. The server checks again on every
 * call, so this is convenience rather than the boundary.
 *
 * It is a form against the database rather than a file in the repo because balance updates
 * land every couple of weeks and the person posting them does so from a browser. A change
 * that needs a commit and a deploy each time is a change that stops being made.
 */
export function NewsAdmin({ editing }: { editing?: NewsItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => (editing ? fromItem(editing) : blank()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/news/${editing.id}` : "/api/news", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          // The input has no zone, so let the browser read it as local and send a real instant.
          publishedAt: draft.publishedAt ? new Date(draft.publishedAt).toISOString() : "",
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "Could not save that");
      setOpen(false);
      if (!editing) setDraft(blank());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing || !confirm(`Delete "${editing.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/news/${editing.id}`, { method: "DELETE" });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "Could not delete that");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-md border border-line bg-bg px-3 py-1.5 text-base focus:border-accent focus:outline-none sm:text-sm";

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gem-purple">Admin</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          {editing ? "Edit" : "Post news"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-md border border-down/50 px-3 py-1.5 text-sm font-medium text-down hover:bg-down/10 disabled:opacity-50"
          >
            Delete
          </button>
        )}
        {error && <p className="w-full text-sm text-down">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-gem-purple/40 bg-gem-purple/5 px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gem-purple">
        {editing ? "Edit news" : "Post news"}
      </span>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Kind</span>
          <select value={draft.kind} onChange={(e) => set("kind", e.target.value as NewsKind)} className={field}>
            {NEWS_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">When it happened</span>
          <input
            type="datetime-local"
            value={draft.publishedAt}
            onChange={(e) => set("publishedAt", e.target.value)}
            className={field}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Title</span>
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value.slice(0, 120))}
          placeholder="Iron Man and Onslaught changed"
          className={field}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">What changed</span>
        <textarea
          value={draft.body}
          onChange={(e) => set("body", e.target.value.slice(0, 4000))}
          rows={5}
          placeholder="One line per change reads best."
          className={`${field} resize-y`}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Link to the official post (optional)</span>
        <input
          value={draft.sourceUrl}
          onChange={(e) => set("sourceUrl", e.target.value)}
          placeholder="https://"
          inputMode="url"
          className={field}
        />
      </label>

      {error && <p className="text-sm text-down">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-jade px-3 py-1.5 text-sm font-semibold text-forest hover:bg-jade-strong disabled:opacity-50"
        >
          {editing ? "Save" : "Post"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setDraft(editing ? fromItem(editing) : blank());
            setError(null);
          }}
          className="text-xs text-faint hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
