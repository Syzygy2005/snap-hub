import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { DECK_SIZE } from "@/lib/cards/types";

/**
 * How many private drafts one account may hold. A policy limit, not a measured one: nothing
 * capped this before, so a stuck retry in the save button, or a script under one session, grew
 * account_decks without bound and the GET returned every row in one response. Raise it freely.
 */
export const ACCOUNT_DECK_LIMIT = 100;

export interface AccountDeck { id: string; name: string; cards: string[]; updatedAt: string }
type Row = { id: string; name: string; cards: string[]; updated_at: Date };
const view = (r: Row): AccountDeck => ({ id: r.id, name: r.name, cards: r.cards, updatedAt: r.updated_at.toISOString() });

export async function accountDecks(ownerId: number): Promise<AccountDeck[]> {
  const db = await getDb();
  return (await db.query<Row>("select id, name, cards, updated_at from account_decks where owner_id = $1 order by updated_at desc", [ownerId])).map(view);
}

export async function saveAccountDeck(ownerId: number, input: { id?: unknown; name?: unknown; cards?: unknown }) {
  if (!Array.isArray(input.cards) || !input.cards.every((c) => typeof c === "string")) {
    return { ok: false as const, error: "Cards must be a list of card IDs.", status: 400 };
  }
  const cards = [...new Set(input.cards as string[])];
  if (!cards.length || cards.length > DECK_SIZE) return { ok: false as const, error: `Save between 1 and ${DECK_SIZE} cards.`, status: 400 };
  const db = await getDb();
  const known = await db.query("select def_id from cards where deckable and def_id = any($1::text[])", [cards]);
  if (known.length !== cards.length) return { ok: false as const, error: "Deck contains unknown cards.", status: 400 };
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 40) || "Untitled deck" : "Untitled deck";
  let row: Row | undefined;
  if (input.id !== undefined) {
    if (typeof input.id !== "string") return { ok: false as const, error: "Invalid deck ID.", status: 400 };
    [row] = await db.query<Row>(
      "update account_decks set name = $1, cards = $2::text[], updated_at = now() where id = $3 and owner_id = $4 returning id, name, cards, updated_at",
      [name, cards, input.id, ownerId],
    );
  } else {
    const [{ count }] = await db.query<{ count: number }>(
      "select count(*)::int as count from account_decks where owner_id = $1", [ownerId]);
    if (count >= ACCOUNT_DECK_LIMIT) {
      return { ok: false as const, error: `You can keep ${ACCOUNT_DECK_LIMIT} saved decks. Delete one to save another.`, status: 409 };
    }
    [row] = await db.query<Row>(
      "insert into account_decks (id, owner_id, name, cards) values ($1, $2, $3, $4::text[]) returning id, name, cards, updated_at",
      [randomUUID(), ownerId, name, cards],
    );
  }
  return row ? { ok: true as const, deck: view(row) } : { ok: false as const, error: "Deck not found.", status: 404 };
}

export async function deleteAccountDeck(ownerId: number, id: string) {
  const db = await getDb();
  return (await db.query("delete from account_decks where id = $1 and owner_id = $2 returning id", [id, ownerId])).length > 0;
}
