"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DECK_SIZE, type Card } from "@/lib/cards/types";
import { decodeDeckInput, encodeDeck, gameClipboardText } from "@/lib/decks/code";
import { AbilityText, CardArt, COST_BUCKETS, EnergyCurve } from "./cards";

const DRAFT_KEY = "snaphub:deck-draft";

const KEYWORDS: { label: string; test: (c: Card) => boolean }[] = [
  { label: "On Reveal", test: (c) => /on reveal/i.test(c.ability) },
  { label: "Ongoing", test: (c) => /ongoing/i.test(c.ability) },
  { label: "Activate", test: (c) => /activate/i.test(c.ability) },
  { label: "End of Turn", test: (c) => /end of turn/i.test(c.ability) },
  { label: "Move", test: (c) => /\bmove/i.test(c.ability) || c.tags.includes("Move") },
  { label: "Destroy", test: (c) => /destroy/i.test(c.ability) },
  { label: "Discard", test: (c) => /discard/i.test(c.ability) },
  { label: "No Ability", test: (c) => !c.ability.trim() },
];

type Sort = "cost" | "power" | "name";

interface Props {
  cards: Card[];
  initial?: { name: string; defIds: string[] } | null;
  importCode?: string | null;
}

type Status = { tone: "ok" | "warn"; text: string } | null;

function importDeck(text: string, cards: Card[]): { deck: string[]; name: string | null; status: Status } | null {
  const decoded = decodeDeckInput(text, cards);
  if (!decoded || decoded.defIds.length === 0) return null;
  const notes = [];
  if (decoded.unresolved.length) notes.push(`${decoded.unresolved.length} unknown card(s) skipped`);
  if (decoded.defIds.length > DECK_SIZE) notes.push(`only the first ${DECK_SIZE} cards kept`);
  return {
    deck: decoded.defIds.slice(0, DECK_SIZE),
    name: decoded.name,
    status: {
      tone: notes.length ? "warn" : "ok",
      text: `Imported ${Math.min(decoded.defIds.length, DECK_SIZE)} cards${notes.length ? ` · ${notes.join(", ")}` : ""}.`,
    },
  };
}

const IMPORT_FAILED: Status = {
  tone: "warn",
  text: "Couldn't read a deck from that. Paste a Marvel Snap deck code or the copied deck text.",
};

// Runs once, in the browser only (this component is loaded with ssr: false).
function startingState(cards: Card[], initial: Props["initial"], importCode: Props["importCode"]) {
  const known = new Set(cards.map((c) => c.defId));
  if (initial) {
    return { deck: initial.defIds.filter((id) => known.has(id)).slice(0, DECK_SIZE), name: initial.name, status: null };
  }
  if (importCode) {
    const imported = importDeck(importCode, cards);
    return imported
      ? { deck: imported.deck, name: imported.name ?? "", status: imported.status }
      : { deck: [], name: "", status: IMPORT_FAILED };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as { name?: string; deck?: string[] } | null;
    if (saved?.deck?.length) {
      return { deck: saved.deck.filter((id) => known.has(id)).slice(0, DECK_SIZE), name: saved.name ?? "", status: null };
    }
  } catch {
    // storage unavailable
  }
  return { deck: [] as string[], name: "", status: null };
}

export function DeckBuilder({ cards, initial, importCode }: Props) {
  const router = useRouter();
  const byId = useMemo(() => new Map(cards.map((c) => [c.defId, c])), [cards]);

  const [start] = useState(() => startingState(cards, initial, importCode));
  const [deck, setDeck] = useState<string[]>(start.deck);
  const [name, setName] = useState(start.name);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [costs, setCosts] = useState<Set<number>>(new Set());
  const [keywords, setKeywords] = useState<Set<string>>(new Set());
  const [series, setSeries] = useState("all");
  const [sort, setSort] = useState<Sort>("cost");

  const [inspect, setInspect] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(start.status);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [saving, setSaving] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flash = (next: Status) => {
    setStatus(next);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 4000);
  };

  const applyImport = (text: string): boolean => {
    const imported = importDeck(text, cards);
    if (!imported) {
      flash(IMPORT_FAILED);
      return false;
    }
    setDeck(imported.deck);
    if (imported.name) setName(imported.name);
    flash(imported.status);
    return true;
  };

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, deck }));
    } catch {
      // storage unavailable
    }
  }, [deck, name]);

  const keywordIndex = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of cards) map.set(c.defId, new Set(KEYWORDS.filter((k) => k.test(c)).map((k) => k.label)));
    return map;
  }, [cards]);

  const seriesOptions = useMemo(() => [...new Set(cards.map((c) => c.series))].sort(), [cards]);

  const pool = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const list = cards.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.ability.toLowerCase().includes(q)) return false;
      if (costs.size && !costs.has(Math.min(c.cost, 6))) return false;
      if (series !== "all" && c.series !== series) return false;
      if (keywords.size) {
        const k = keywordIndex.get(c.defId)!;
        for (const want of keywords) if (!k.has(want)) return false;
      }
      return true;
    });
    const cmp: Record<Sort, (a: Card, b: Card) => number> = {
      cost: (a, b) => a.cost - b.cost || a.name.localeCompare(b.name),
      power: (a, b) => b.power - a.power || a.cost - b.cost || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(cmp[sort]);
  }, [cards, deferredQuery, costs, series, keywords, keywordIndex, sort]);

  const deckCards = useMemo(
    () =>
      deck
        .map((id) => byId.get(id))
        .filter((c): c is Card => !!c)
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name)),
    [deck, byId],
  );
  const inDeck = useMemo(() => new Set(deck), [deck]);
  const full = deck.length >= DECK_SIZE;
  const complete = deck.length === DECK_SIZE;

  const toggleCard = (id: string) => {
    if (inDeck.has(id)) {
      setDeck((d) => d.filter((x) => x !== id));
    } else if (full) {
      flash({ tone: "warn", text: `Your deck already has ${DECK_SIZE} cards. Remove one first.` });
    } else {
      setDeck((d) => [...d, id]);
    }
  };

  const toggleIn = <T,>(set: Set<T>, value: T, update: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash({ tone: "ok", text: `${label} copied.` });
    } catch {
      flash({ tone: "warn", text: "Clipboard blocked by the browser. Try again or copy manually." });
    }
  };

  const share = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, cards: deckCards.map((c) => c.defId) }),
      });
      const body = (await res.json()) as { ok: boolean; id?: string; error?: string };
      if (!body.ok || !body.id) throw new Error(body.error ?? "Save failed");
      router.push(`/decks/${body.id}`);
    } catch (err) {
      flash({ tone: "warn", text: err instanceof Error ? err.message : "Save failed" });
      setSaving(false);
    }
  };

  const inspected = (inspect && byId.get(inspect)) || deckCards.at(-1) || null;
  const avgCost = deckCards.length ? deckCards.reduce((s, c) => s + c.cost, 0) / deckCards.length : 0;
  const totalPower = deckCards.reduce((s, c) => s + c.power, 0);
  const deckKeywords = KEYWORDS.map((k) => ({
    label: k.label,
    n: deckCards.filter((c) => keywordIndex.get(c.defId)?.has(k.label)).length,
  })).filter((k) => k.n > 0);
  const filtersActive = !!query || costs.size > 0 || keywords.size > 0 || series !== "all";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Card pool */}
      <section aria-label="Card pool" className="min-w-0">
        <div className="mb-4 space-y-3 rounded-xl border border-line bg-surface/80 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or ability…"
              aria-label="Search cards"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
            />
            <select
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              aria-label="Series"
              className="rounded-lg border border-line bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
            >
              <option value="all">All series</option>
              {seriesOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort by"
              className="rounded-lg border border-line bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
            >
              <option value="cost">Sort: Cost</option>
              <option value="power">Sort: Power</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by cost">
            <span className="mr-1 text-xs uppercase tracking-wider text-faint">Cost</span>
            {COST_BUCKETS.map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={costs.has(b)}
                onClick={() => toggleIn(costs, b, setCosts)}
                className={`num h-8 min-w-8 rounded-sm border px-2 text-sm font-semibold transition-colors ${
                  costs.has(b) ? "border-accent bg-accent text-bg" : "border-line text-muted hover:border-accent/60 hover:text-ink"
                }`}
              >
                {b === 6 ? "6+" : b}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by ability">
            <span className="mr-1 text-xs uppercase tracking-wider text-faint">Ability</span>
            {KEYWORDS.map((k) => (
              <button
                key={k.label}
                type="button"
                aria-pressed={keywords.has(k.label)}
                onClick={() => toggleIn(keywords, k.label, setKeywords)}
                className={`rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors ${
                  keywords.has(k.label)
                    ? "border-accent bg-accent/20 text-ink"
                    : "border-line text-muted hover:border-accent/60 hover:text-ink"
                }`}
              >
                {k.label}
              </button>
            ))}
            <span className="num ml-auto text-xs text-faint">
              {pool.length} card{pool.length === 1 ? "" : "s"}
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCosts(new Set());
                    setKeywords(new Set());
                    setSeries("all");
                  }}
                  className="ml-2 text-accent hover:underline"
                >
                  Clear filters
                </button>
              )}
            </span>
          </div>
        </div>

        {pool.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">No cards match those filters.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
            {pool.map((c, i) => {
              const picked = inDeck.has(c.defId);
              return (
                <li key={c.defId}>
                  <button
                    type="button"
                    onClick={() => toggleCard(c.defId)}
                    onMouseEnter={() => setInspect(c.defId)}
                    onFocus={() => setInspect(c.defId)}
                    aria-pressed={picked}
                    aria-label={`${c.name}, cost ${c.cost}, power ${c.power}${picked ? ", in deck" : ""}`}
                    className={`group relative block w-full rounded-lg p-1 transition ${
                      picked ? "bg-accent/15 ring-2 ring-accent" : "hover:bg-surface-2"
                    } ${!picked && full ? "opacity-50" : ""}`}
                  >
                    <CardArt card={c} eager={i < 18} className="transition-transform group-hover:scale-[1.03]" />
                    {picked && (
                      <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-bg shadow">
                        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                          <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </span>
                    )}
                    <span className="mt-0.5 block truncate text-center text-[11px] text-muted group-hover:text-ink">{c.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Deck panel */}
      <aside id="deck" aria-label="Your deck" className="scroll-mt-20 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto scroll-thin">
        <div className="rounded-xl border border-line bg-surface/90">
          <div className="flex items-center gap-2 border-b border-line p-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="Deck name"
              aria-label="Deck name"
              className="min-w-0 flex-1 rounded-md bg-transparent px-1 font-display text-lg font-bold uppercase tracking-wide placeholder:text-faint focus:outline-none"
            />
            <span className={`num rounded-md px-2 py-1 text-sm font-bold ${complete ? "bg-up/15 text-up" : "bg-surface-3 text-muted"}`}>
              {deck.length}/{DECK_SIZE}
            </span>
          </div>

          <ul className="grid grid-cols-4 gap-1.5 p-3">
            {Array.from({ length: DECK_SIZE }, (_, i) => {
              const c = deckCards[i];
              return (
                <li key={c?.defId ?? `empty-${i}`}>
                  {c ? (
                    <button
                      type="button"
                      onClick={() => toggleCard(c.defId)}
                      onMouseEnter={() => setInspect(c.defId)}
                      onFocus={() => setInspect(c.defId)}
                      title={`Remove ${c.name}`}
                      aria-label={`Remove ${c.name}`}
                      className="group relative block w-full rounded-md hover:bg-down/10"
                    >
                      <CardArt card={c} eager />
                      <span className="absolute inset-0 hidden place-items-center rounded-md bg-bg/60 text-xs font-semibold text-down group-hover:grid">
                        Remove
                      </span>
                    </button>
                  ) : (
                    <div className="grid aspect-square place-items-center rounded-md border border-dashed border-line text-xs text-faint">
                      {i + 1}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="grid grid-cols-3 gap-2 border-t border-line px-3 py-3 text-center">
            <div>
              <div className="num font-display text-xl font-bold">{avgCost.toFixed(1)}</div>
              <div className="text-[11px] uppercase tracking-wider text-faint">Avg cost</div>
            </div>
            <div>
              <div className="num font-display text-xl font-bold text-gold">{totalPower}</div>
              <div className="text-[11px] uppercase tracking-wider text-faint">Power</div>
            </div>
            <div>
              <div className="num font-display text-xl font-bold">{deckCards.filter((c) => c.cost >= 5).length}</div>
              <div className="text-[11px] uppercase tracking-wider text-faint">5+ cost</div>
            </div>
          </div>

          <div className="border-t border-line px-3 py-3">
            <EnergyCurve cards={deckCards} />
            {deckKeywords.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {deckKeywords.map((k) => (
                  <span key={k.label} className="rounded-sm bg-surface-3 px-2 py-0.5 text-[11px] text-muted">
                    {k.label} <span className="num font-semibold text-ink">{k.n}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
            <button
              type="button"
              disabled={!deck.length}
              onClick={() => copy(encodeDeck(deckCards.map((c) => c.defId), name), "Deck code")}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              Copy code
            </button>
            <button
              type="button"
              disabled={!complete || saving}
              onClick={share}
              title={complete ? "Save and get a share link" : `Add ${DECK_SIZE - deck.length} more card(s) to share`}
              className="rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-ink hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving…" : "Share link"}
            </button>
            <button
              type="button"
              disabled={!deck.length}
              onClick={() => copy(gameClipboardText(deckCards, name), "Deck list")}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-40"
            >
              Copy with card list
            </button>
            <button
              type="button"
              onClick={() => setImportOpen((o) => !o)}
              aria-expanded={importOpen}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
            >
              Import code
            </button>
            {importOpen && (
              <div className="col-span-2 space-y-2">
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={4}
                  placeholder="Paste a deck code or the text copied from Marvel Snap"
                  aria-label="Deck code to import"
                  className="w-full rounded-lg border border-line bg-bg p-2 font-mono text-xs placeholder:font-sans placeholder:text-faint focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (applyImport(importText)) {
                      setImportOpen(false);
                      setImportText("");
                    }
                  }}
                  className="w-full rounded-lg bg-surface-3 px-3 py-1.5 text-sm font-medium hover:bg-line"
                >
                  Load deck
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={!deck.length}
              onClick={() => {
                setDeck([]);
                setName("");
              }}
              className="col-span-2 text-xs text-faint hover:text-down disabled:opacity-40"
            >
              Clear deck
            </button>
          </div>

          <p aria-live="polite" className={`min-h-5 px-3 pb-2 text-xs ${status?.tone === "warn" ? "text-down" : "text-up"}`}>
            {status?.text}
          </p>

          {inspected && (
            <div className="flex gap-3 border-t border-line p-3">
              <div className="w-20 shrink-0">
                <CardArt card={inspected} eager />
              </div>
              <div className="min-w-0 text-sm">
                <div className="font-semibold">{inspected.name}</div>
                <div className="num text-xs text-muted">
                  Cost {inspected.cost} · Power {inspected.power} · {inspected.series}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  <AbilityText text={inspected.ability} />
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile shortcut to the deck panel */}
      <a
        href="#deck"
        className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-xl border border-accent/50 bg-surface-2/95 px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur lg:hidden"
      >
        <span>View deck</span>
        <span className={`num ${complete ? "text-up" : "text-muted"}`}>
          {deck.length}/{DECK_SIZE}
        </span>
      </a>
    </div>
  );
}
