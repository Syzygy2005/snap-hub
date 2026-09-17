"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Card } from "@/lib/cards/types";
import type { SavedDeck } from "@/lib/decks/queries";
import { DECKS_KEY, parseLocalDecks, UNTITLED, type LocalDeck } from "@/lib/decks/local";
import { CardArt } from "./cards";
import { RelativeTime } from "./relative-time";
import { EmptyState } from "./ui";

interface Props {
  /** Already filtered by the server against the same q and cards. */
  decks: SavedDeck[];
  cards: Card[];
  q: string;
  selected: string[];
}

const PICKER_LIMIT = 8;

// useSyncExternalStore calls getSnapshot on every render and compares by identity, so the
// parsed list has to be cached until the stored text actually changes.
const NO_DECKS: LocalDeck[] = [];
let cachedRaw: string | null | undefined;
let cachedDecks: LocalDeck[] = NO_DECKS;

function localSnapshot(): LocalDeck[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DECKS_KEY);
  } catch {
    // storage unavailable
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDecks = parseLocalDecks(raw);
  }
  return cachedDecks;
}

/** Only fires for edits made in another tab, which is when this list would otherwise go stale. */
function subscribeToLocalDecks(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function decksHref(q: string, cards: string[]): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  for (const c of cards) p.append("card", c);
  const s = p.toString();
  return s ? `/decks?${s}` : "/decks";
}

function DeckTile({
  href,
  name,
  cards,
  meta,
  badge,
}: {
  href: string;
  name: string;
  cards: Card[];
  meta: React.ReactNode;
  badge?: string;
}) {
  const avg = cards.length ? cards.reduce((s, c) => s + c.cost, 0) / cards.length : 0;
  return (
    <Link href={href} className="block rounded-xl border border-line bg-surface/80 p-3 transition-colors hover:border-accent/60">
      <div className="grid grid-cols-6 gap-1">
        {cards.map((c) => (
          <CardArt key={c.defId} card={c} />
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="truncate font-display text-sm font-bold uppercase tracking-wide">{name}</span>
        <span className="num shrink-0 text-xs text-muted">avg {avg.toFixed(1)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-faint">
        <span className="min-w-0 truncate">{meta}</span>
        {badge && (
          <span className="shrink-0 rounded-sm border border-line px-1 text-[10px] font-medium uppercase tracking-wide">
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

export function DeckDirectory({ decks, cards, q, selected }: Props) {
  const byId = useMemo(() => new Map(cards.map((c) => [c.defId, c])), [cards]);
  const resolve = (ids: string[]) =>
    ids
      .map((id) => byId.get(id))
      .filter((c): c is Card => !!c)
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  // Decks saved in this browser. Empty on the server, which has no way to see them.
  const local = useSyncExternalStore(subscribeToLocalDecks, localSnapshot, () => NO_DECKS);

  const [pick, setPick] = useState("");
  const matches = useMemo(() => {
    const needle = pick.trim().toLowerCase();
    if (!needle) return [];
    return cards
      .filter((c) => !selected.includes(c.defId) && c.name.toLowerCase().includes(needle))
      .slice(0, PICKER_LIMIT);
  }, [pick, cards, selected]);

  // The server filters the shared decks; the same rules are applied here to the private ones.
  const localMatches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return local.filter((d) => {
      if (selected.length && !selected.every((id) => d.cards.includes(id))) return false;
      if (!needle) return true;
      if (d.name.toLowerCase().includes(needle)) return true;
      return d.cards.some((id) => byId.get(id)?.name.toLowerCase().includes(needle));
    });
  }, [local, q, selected, byId]);

  const filtering = !!q || selected.length > 0;

  return (
    <>
      <div className="mb-6 space-y-3 rounded-xl border border-line bg-surface/80 p-3">
        <form action="/decks" className="flex flex-wrap gap-2">
          {selected.map((id) => (
            <input key={id} type="hidden" name="card" value={id} />
          ))}
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search deck names and cards…"
            aria-label="Search decks"
            className="min-w-0 flex-1 basis-full rounded-lg border border-line bg-bg px-3 py-1.5 text-base placeholder:text-faint focus:border-accent focus:outline-none sm:basis-auto sm:text-sm"
          />
          <button className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-bg hover:bg-accent-strong">
            Search
          </button>
          {filtering && (
            <Link href="/decks" className="self-center text-sm text-accent hover:underline">
              Clear
            </Link>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-faint">Has card</span>
          {selected.map((id) => (
            <Link
              key={id}
              href={decksHref(q, selected.filter((c) => c !== id))}
              className="inline-flex items-center gap-1.5 rounded-sm border border-accent bg-accent/20 px-2 py-1 text-xs font-medium text-ink"
            >
              {byId.get(id)?.name ?? id}
              <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden>
                <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="sr-only">Remove this card filter</span>
            </Link>
          ))}
          <input
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            placeholder="Add a card…"
            aria-label="Filter decks by a card they contain"
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-1 text-base placeholder:text-faint focus:border-accent focus:outline-none sm:w-40 sm:flex-none sm:text-sm"
          />
        </div>

        {matches.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {matches.map((c) => (
              <li key={c.defId}>
                <Link
                  href={decksHref(q, [...selected, c.defId])}
                  onClick={() => setPick("")}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2 py-1 text-xs text-muted hover:border-accent/60 hover:text-ink"
                >
                  <CardArt card={c} className="h-5 w-5" />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {localMatches.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 border-l-2 border-accent pl-2.5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">My decks</h2>
            <p className="text-xs text-faint">Saved in this browser. Nobody else can see these.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {localMatches.map((d) => (
              <li key={d.id}>
                <DeckTile
                  href={`/decks/builder?local=${encodeURIComponent(d.id)}`}
                  name={d.name || UNTITLED}
                  cards={resolve(d.cards)}
                  meta={<RelativeTime iso={d.updatedAt} />}
                  badge="Private"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {localMatches.length > 0 && (
          <div className="mb-3 border-l-2 border-accent pl-2.5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Shared decks</h2>
            <p className="text-xs text-faint">Posted by anyone with the link. Visible to everyone.</p>
          </div>
        )}
        {decks.length === 0 ? (
          filtering ? (
            <EmptyState title="No shared decks match">
              Try a different card or search term, or <Link href="/decks" className="text-accent hover:underline">clear the filters</Link>.
            </EmptyState>
          ) : (
            <EmptyState title="No decks shared yet">
              Build one in the <Link href="/decks/builder" className="text-accent hover:underline">deck builder</Link> and
              press Share link.
            </EmptyState>
          )
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {decks.map((d) => (
              <li key={d.id}>
                <DeckTile
                  href={`/decks/${d.id}`}
                  name={d.name}
                  cards={resolve(d.cards)}
                  meta={
                    <>
                      {d.owner && (
                        <>
                          <span className="text-muted">{d.owner}</span>
                          {" · "}
                        </>
                      )}
                      <RelativeTime iso={d.createdAt} /> · {d.views} view{d.views === 1 ? "" : "s"}
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
