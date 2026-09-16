/**
 * Decks the visitor keeps in their own browser. There are no accounts, so these never leave
 * the device: localStorage only, and every read has to cope with it being unavailable
 * (Safari private mode), full, or holding something another version of the site wrote.
 */

export interface LocalDeck {
  id: string;
  name: string;
  cards: string[];
  updatedAt: string;
}

/** The deck currently open in the builder, saved on every edit so a refresh doesn't lose it. */
export interface Draft {
  name: string;
  deck: string[];
  /** id of the saved deck being edited, or null when this is a new one. */
  savedId: string | null;
}

export const DECKS_KEY = "snaphub:decks";
export const DRAFT_KEY = "snaphub:deck-draft";

export const UNTITLED = "Untitled deck";

const newest = (a: LocalDeck, b: LocalDeck) => b.updatedAt.localeCompare(a.updatedAt);

export function newDeckId(): string {
  // randomUUID needs a secure context, which a LAN address over plain http isn't.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Reads whatever is in storage, dropping anything that isn't a deck we can use. */
export function parseLocalDecks(raw: string | null): LocalDeck[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "null");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const decks: LocalDeck[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    if (typeof d.id !== "string" || !d.id || seen.has(d.id)) continue;
    if (!Array.isArray(d.cards) || !d.cards.every((c) => typeof c === "string")) continue;
    seen.add(d.id);
    decks.push({
      id: d.id,
      name: typeof d.name === "string" && d.name.trim() ? d.name : UNTITLED,
      cards: d.cards as string[],
      updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : new Date(0).toISOString(),
    });
  }
  return decks.sort(newest);
}

export function parseDraft(raw: string | null): Draft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "null");
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const d = parsed as Record<string, unknown>;
  if (!Array.isArray(d.deck) || !d.deck.every((c) => typeof c === "string")) return null;
  return {
    name: typeof d.name === "string" ? d.name : "",
    deck: d.deck as string[],
    savedId: typeof d.savedId === "string" ? d.savedId : null,
  };
}

/** Replaces the deck with this id, or adds it when the id is new. */
export function upsertLocalDeck(decks: LocalDeck[], deck: LocalDeck): LocalDeck[] {
  return [deck, ...decks.filter((d) => d.id !== deck.id)].sort(newest);
}

export function removeLocalDeck(decks: LocalDeck[], id: string): LocalDeck[] {
  return decks.filter((d) => d.id !== id);
}

export function sameCards(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function readLocalDecks(): LocalDeck[] {
  try {
    return parseLocalDecks(localStorage.getItem(DECKS_KEY));
  } catch {
    return [];
  }
}

/** False when the write failed, which on a full quota is the only warning the visitor gets. */
export function writeLocalDecks(decks: LocalDeck[]): boolean {
  try {
    localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
    return true;
  } catch {
    return false;
  }
}

export function readDraft(): Draft | null {
  try {
    return parseDraft(localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}

export function writeDraft(draft: Draft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage unavailable
  }
}
