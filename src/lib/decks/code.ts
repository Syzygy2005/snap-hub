// Marvel Snap deck codes. Runs in the browser and on the server.
//
// Long format (in use since launch, always accepted by the game):
//   base64( {"Name":"My Deck","Cards":[{"CardDefId":"AntMan"}, ...]} )
// Short format (late 2024+): base64 of comma-separated tokens, each token being the
// CardDefId with vowels removed plus its original length, e.g. "Sunspot" -> "Snspt7".
// We always export the long format and import either.

import type { Card } from "@/lib/cards/types";

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToText(input: string): string | null {
  let s = input.trim().replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+=*$/.test(s)) return null;
  s = s.replace(/=+$/, "");
  if (s.length % 4 === 1) return null;
  s += "=".repeat((4 - (s.length % 4)) % 4);
  try {
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function encodeDeck(defIds: string[], name?: string): string {
  const payload: { Name?: string; Cards: { CardDefId: string }[] } = {
    Cards: defIds.map((id) => ({ CardDefId: id })),
  };
  const body = name?.trim() ? { Name: name.trim(), ...payload } : payload;
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(body)));
}

export function shortToken(defId: string): string {
  return defId.replace(/[aeiou]/gi, "") + defId.length;
}

/** The text the game itself puts on the clipboard: a readable card list around the code. */
export function gameClipboardText(cards: Pick<Card, "defId" | "name" | "cost">[], name?: string): string {
  const sorted = [...cards].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  return [
    ...sorted.map((c) => `# (${c.cost}) ${c.name}`),
    "#",
    encodeDeck(
      sorted.map((c) => c.defId),
      name,
    ),
    "#",
    "# To use this deck, copy it to your clipboard and paste it from the deck editing menu in MARVEL SNAP",
  ].join("\n");
}

export interface DecodedDeck {
  name: string | null;
  defIds: string[];
  /** Tokens or names we could not match to a known card. */
  unresolved: string[];
}

const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Accepts a bare code (long or short), the game's full clipboard text, or a plain
 * "# (2) Card Name" list. Returns null when nothing recognisable was found.
 */
export function decodeDeckInput(input: string, cards: Pick<Card, "defId" | "name">[]): DecodedDeck | null {
  const byDefId = new Map(cards.map((c) => [c.defId.toLowerCase(), c.defId]));
  const byName = new Map(cards.map((c) => [normalizeName(c.name), c.defId]));
  const byShort = new Map<string, string>();
  for (const c of cards) {
    const key = shortToken(c.defId).toLowerCase();
    if (!byShort.has(key)) byShort.set(key, c.defId);
  }

  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const candidates = [...lines.filter((l) => !l.startsWith("#")), input.trim()];

  for (const candidate of candidates) {
    const text = base64ToText(candidate);
    if (!text) continue;

    try {
      const json = JSON.parse(text) as { Name?: unknown; Cards?: { CardDefId?: unknown }[] };
      if (Array.isArray(json.Cards)) {
        const ids = json.Cards.map((c) => (typeof c?.CardDefId === "string" ? c.CardDefId : "")).filter(Boolean);
        return resolve(ids, (id) => byDefId.get(id.toLowerCase()), typeof json.Name === "string" ? json.Name : null);
      }
    } catch {
      // not JSON; maybe the short format
    }

    const tokens = text.split(",").map((t) => t.trim()).filter(Boolean);
    if (tokens.length && tokens.every((t) => /^[A-Za-z0-9]+$/.test(t))) {
      return resolve(tokens, (t) => byShort.get(t.toLowerCase()) ?? byDefId.get(t.toLowerCase()), null);
    }
  }

  const listed = lines
    .map((l) => /^#\s*\(\s*\d+\s*\)\s*(.+)$/.exec(l)?.[1])
    .filter((n): n is string => !!n);
  if (listed.length) return resolve(listed, (n) => byName.get(normalizeName(n)), null);

  return null;
}

function resolve(tokens: string[], lookup: (t: string) => string | undefined, name: string | null): DecodedDeck {
  const defIds: string[] = [];
  const unresolved: string[] = [];
  for (const t of tokens) {
    const id = lookup(t);
    if (!id) unresolved.push(t);
    else if (!defIds.includes(id)) defIds.push(id);
  }
  return { name, defIds, unresolved };
}
