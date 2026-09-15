import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { DECK_SIZE } from "@/lib/cards/types";

export interface SavedDeck {
  id: string;
  name: string;
  cards: string[];
  createdAt: string;
  views: number;
}

const toDeck = (r: { id: string; name: string; cards: string[]; created_at: Date; views: number }): SavedDeck => ({
  id: r.id,
  name: r.name,
  cards: r.cards,
  createdAt: r.created_at.toISOString(),
  views: r.views,
});

export type SaveDeckResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveDeck(input: { name?: unknown; cards?: unknown }): Promise<SaveDeckResult> {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 40) : "";
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
    `select id from decks where card_key = $1 and name = $2`,
    [cardKey, finalName],
  );
  if (existing) return { ok: true, id: existing.id };

  const id = randomBytes(6).toString("base64url");
  await db.query(
    `insert into decks (id, name, cards, card_key) values ($1, $2, $3::text[], $4)
     on conflict (card_key, name) do nothing`,
    [id, finalName, cards, cardKey],
  );
  const [row] = await db.query<{ id: string }>(`select id from decks where card_key = $1 and name = $2`, [
    cardKey,
    finalName,
  ]);
  return { ok: true, id: row.id };
}

export async function getDeck(id: string, countView = false): Promise<SavedDeck | null> {
  const db = await getDb();
  const rows = countView
    ? await db.query<Parameters<typeof toDeck>[0]>(
        `update decks set views = views + 1 where id = $1 returning id, name, cards, created_at, views`,
        [id],
      )
    : await db.query<Parameters<typeof toDeck>[0]>(
        `select id, name, cards, created_at, views from decks where id = $1`,
        [id],
      );
  return rows[0] ? toDeck(rows[0]) : null;
}

export async function listDecks(limit = 48, offset = 0): Promise<SavedDeck[]> {
  const db = await getDb();
  const rows = await db.query<Parameters<typeof toDeck>[0]>(
    `select id, name, cards, created_at, views from decks order by created_at desc limit $1 offset $2`,
    [limit, offset],
  );
  return rows.map(toDeck);
}
