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
  /** Display name of whoever posted it; null for signed-out and pre-accounts decks. */
  owner: string | null;
}

const toDeck = (r: {
  id: string;
  name: string;
  cards: string[];
  created_at: Date;
  views: number;
  listed: boolean;
  owner: string | null;
}): SavedDeck => ({
  id: r.id,
  name: r.name,
  cards: r.cards,
  createdAt: r.created_at.toISOString(),
  views: r.views,
  listed: r.listed,
  owner: r.owner,
});

// Every read wants the poster's name rather than their id, and a deck outlives its owner's account.
const DECK_COLUMNS = `d.id, d.name, d.cards, d.created_at, d.views, d.listed, a.username as owner`;
const DECK_FROM = `from decks d left join accounts a on a.id = d.owner_id`;

export type SaveDeckResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveDeck(
  input: {
    name?: unknown;
    cards?: unknown;
    listed?: unknown;
  },
  ownerId?: number | null,
): Promise<SaveDeckResult> {
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
  const owner = ownerId ?? null;
  // "is not distinct from" so a signed-out re-post finds the earlier signed-out one, which
  // plain = would not, null being equal to nothing.
  const mine = `card_key = $1 and name = $2 and listed = $3 and owner_id is not distinct from $4`;
  const [existing] = await db.query<{ id: string }>(`select id from decks where ${mine}`, [
    cardKey,
    finalName,
    listed,
    owner,
  ]);
  if (existing) return { ok: true, id: existing.id };

  const id = randomBytes(6).toString("base64url");
  await db.query(
    `insert into decks (id, name, cards, card_key, listed, owner_id) values ($1, $2, $3::text[], $4, $5, $6)
     on conflict (card_key, name, listed, owner_id) do nothing`,
    [id, finalName, cards, cardKey, listed, owner],
  );
  const [row] = await db.query<{ id: string }>(`select id from decks where ${mine}`, [
    cardKey,
    finalName,
    listed,
    owner,
  ]);
  return { ok: true, id: row.id };
}

export async function getDeck(id: string): Promise<SavedDeck | null> {
  const db = await getDb();
  // Unlisted decks are fetched the same way: the link is what grants access.
  const rows = await db.query<Parameters<typeof toDeck>[0]>(`select ${DECK_COLUMNS} ${DECK_FROM} where d.id = $1`, [id]);
  return rows[0] ? toDeck(rows[0]) : null;
}

/**
 * Counts one view of a deck, never its owner's own. Called from the browser once per deck per
 * browser (see CountView), not from the page render: the render counted every refresh, and every
 * link preview a chat app fetched. Views rank nothing, so this aims at an honest count from
 * ordinary browsing rather than at someone scripting the endpoint.
 */
export async function countDeckView(id: string, viewerAccountId: number | null): Promise<boolean> {
  const db = await getDb();
  // Spelled out rather than "owner_id is distinct from $2": with a signed-out viewer that reads
  // null is distinct from null on a signed-out deck, which is false, and those views never count.
  const rows = await db.query<{ id: string }>(
    `update decks set views = views + 1
     where id = $1 and ($2::int is null or owner_id is distinct from $2::int) returning id`,
    [id, viewerAccountId],
  );
  return rows.length > 0;
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
    `select ${DECK_COLUMNS}
       ${DECK_FROM}
      where d.listed
        and ($1 = '' or d.name ilike $2 or d.cards && (
              select coalesce(array_agg(def_id), '{}'::text[]) from cards where name ilike $2
             ))
        and ($3::text[] = '{}'::text[] or d.cards @> $3::text[])
      order by d.created_at desc
      limit $4 offset $5`,
    [q, likePattern(q), cards, opts.limit ?? 48, opts.offset ?? 0],
  );
  return rows.map(toDeck);
}

/** Moderation, not tidying: there is no undo, so only an admin route reaches this. */
export async function deleteDeck(id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query<{ id: string }>(`delete from decks where id = $1 returning id`, [id]);
  return rows.length > 0;
}

/**
 * Renames a deck in place, for the usual case where the list is fine and the name is not.
 * The dedupe key includes the name, so a rename can collide with a deck that already has
 * the new name; the unique index refuses that rather than merging two people's decks.
 */
export async function renameDeck(id: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return { ok: false, error: "Give the deck a name." };
  const db = await getDb();
  try {
    const rows = await db.query<{ id: string }>(`update decks set name = $1 where id = $2 returning id`, [
      trimmed,
      id,
    ]);
    return rows.length > 0 ? { ok: true } : { ok: false, error: "That deck no longer exists." };
  } catch {
    return { ok: false, error: "Another deck with the same cards already uses that name." };
  }
}
