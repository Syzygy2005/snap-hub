import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { DECK_SIZE } from "@/lib/cards/types";

export interface SavedDeck {
  id: string;
  name: string;
  cards: string[];
  createdAt: string;
  views: number;
  /** false = reachable by link but kept off the Decks page. */
  listed: boolean;
}

const toDeck = (r: {
  id: string;
  name: string;
  cards: string[];
  created_at: Date;
  views: number;
  listed: boolean;
}): SavedDeck => ({
  id: r.id,
  name: r.name,
  cards: r.cards,
  createdAt: r.created_at.toISOString(),
  views: r.views,
  listed: r.listed,
});

export type SaveDeckResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveDeck(input: {
  name?: unknown;
  cards?: unknown;
  listed?: unknown;
}): Promise<SaveDeckResult> {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 40) : "";
  // Anything other than an explicit false stays public, so an old client keeps its behaviour.
  const listed = input.listed !== false;
  if (!Array.isArray(input.cards) || !input.cards.every((c) => typeof c === "string")) {
    return { ok: false, error: "Cards must be a list of card IDs." };
  }
  const cards = [...new Set(input.cards as string[])];
  if (cards.length !== DECK_SIZE) return { ok: false, error: `A deck needs exactly ${DECK_SIZE} different cards.` };

  const db = await getDb();
  const known = await db.query<{ def_id: string }>(
    `select def_id from cards where deckable and def_id = any($1::text[])`,
    [cards],
  );
  if (known.length !== DECK_SIZE) return { ok: false, error: "Deck contains unknown cards." };

  const cardKey = [...cards].sort().join(",");
  const finalName = name || "Untitled deck";
  const [existing] = await db.query<{ id: string }>(
    `select id from decks where card_key = $1 and name = $2 and listed = $3`,
    [cardKey, finalName, listed],
  );
  if (existing) return { ok: true, id: existing.id };

  const id = randomBytes(6).toString("base64url");
  await db.query(
    `insert into decks (id, name, cards, card_key, listed) values ($1, $2, $3::text[], $4, $5)
     on conflict (card_key, name, listed) do nothing`,
    [id, finalName, cards, cardKey, listed],
  );
  const [row] = await db.query<{ id: string }>(
    `select id from decks where card_key = $1 and name = $2 and listed = $3`,
    [cardKey, finalName, listed],
  );
  return { ok: true, id: row.id };
}

export async function getDeck(id: string, countView = false): Promise<SavedDeck | null> {
  const db = await getDb();
  // Unlisted decks are fetched the same way: the link is what grants access.
  const rows = countView
    ? await db.query<Parameters<typeof toDeck>[0]>(
        `update decks set views = views + 1 where id = $1 returning id, name, cards, created_at, views, listed`,
        [id],
      )
    : await db.query<Parameters<typeof toDeck>[0]>(
        `select id, name, cards, created_at, views, listed from decks where id = $1`,
        [id],
      );
  return rows[0] ? toDeck(rows[0]) : null;
}

export interface DeckQuery {
  /** Matches the deck name or the name of any card in the deck. */
  q?: string;
  /** def_ids the deck must contain, all of them. */
  cards?: string[];
  limit?: number;
  offset?: number;
}

/** Escapes a user's text so % and _ match themselves instead of acting as wildcards. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export async function listDecks(opts: DeckQuery = {}): Promise<SavedDeck[]> {
  const db = await getDb();
  const q = (opts.q ?? "").trim();
  const cards = opts.cards ?? [];
  const rows = await db.query<Parameters<typeof toDeck>[0]>(
    `select id, name, cards, created_at, views, listed
       from decks
      where listed
        and ($1 = '' or name ilike $2 or cards && (
              select coalesce(array_agg(def_id), '{}'::text[]) from cards where name ilike $2
             ))
        and ($3::text[] = '{}'::text[] or cards @> $3::text[])
      order by created_at desc
      limit $4 offset $5`,
    [q, likePattern(q), cards, opts.limit ?? 48, opts.offset ?? 0],
  );
  return rows.map(toDeck);
}
