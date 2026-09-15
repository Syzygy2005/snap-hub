import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { deckKey } from "./aggregate";
import { parseGameState, type ParsedGame } from "./parse-game";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export interface Tracker {
  id: number;
  name: string;
}

export type CreateTrackerResult = { ok: true; token: string; tracker: Tracker } | { ok: false; error: string; status: number };

/** Anyone can make a key unless TRACKER_INVITE_CODE is set, in which case they need the code. */
export async function createTracker(input: { name?: unknown; inviteCode?: unknown }): Promise<CreateTrackerResult> {
  const required = process.env.TRACKER_INVITE_CODE;
  if (required) {
    const given = Buffer.from(typeof input.inviteCode === "string" ? input.inviteCode : "");
    const expected = Buffer.from(required);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return { ok: false, error: "That invite code isn't right.", status: 403 };
    }
  }
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 30) : "";
  if (!name) return { ok: false, error: "Pick a display name.", status: 400 };

  const token = `shk_${randomBytes(24).toString("base64url")}`;
  const db = await getDb();
  const [row] = await db.query<Tracker>(
    `insert into trackers (name, token_hash) values ($1, $2) returning id, name`,
    [name, sha256(token)],
  );
  return { ok: true, token, tracker: row };
}

export function trackerInviteRequired(): boolean {
  return !!process.env.TRACKER_INVITE_CODE;
}

export async function authenticate(request: Request): Promise<Tracker | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(shk_[\w-]{20,})$/.exec(header.trim())?.[1];
  if (!token) return null;
  const db = await getDb();
  const [row] = await db.query<Tracker>(`select id, name from trackers where token_hash = $1`, [sha256(token)]);
  return row ?? null;
}

export type RecordResult =
  | { ok: true; duplicate: boolean; game: Pick<ParsedGame, "gameId" | "result" | "cubes" | "deckName" | "opponentName" | "league"> }
  | { ok: false; status: number; reason: string; detail: string };

export async function recordGame(
  tracker: Tracker,
  gameStateText: string,
  accountId: string | null,
  now = new Date(),
): Promise<RecordResult> {
  const parsed = parseGameState(gameStateText, accountId);
  if (!parsed.ok) return { ok: false, status: 422, reason: parsed.reason, detail: parsed.detail };
  const g = parsed.game;

  // Only a hash of the Snap account ID is kept. Without one, dedupe per tracker key.
  const accountHash = sha256(`snaphub:${accountId || `tracker-${tracker.id}`}`);

  const db = await getDb();
  const inserted = await db.query<{ id: number }>(
    `insert into tracked_games (tracker_id, account_hash, game_id, played_at, league, battle_mode, friendly, result,
                                cubes, final_cube_value, snapped, opponent_snapped, conceded, turns, total_turns,
                                deck_name, deck_cards, deck_key, opponent_name, opponent_cards, cards_drawn,
                                cards_played, locations)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::text[], $18, $19,
             $20::text[], $21::text[], $22::text[], $23::text[])
     on conflict (game_id, account_hash) do nothing
     returning id`,
    [
      tracker.id,
      accountHash,
      g.gameId,
      now,
      g.league,
      g.battleMode,
      g.friendly,
      g.result,
      g.cubes,
      g.finalCubeValue,
      g.snapped,
      g.opponentSnapped,
      g.conceded,
      g.turns,
      g.totalTurns,
      g.deckName,
      g.deckCards,
      deckKey(g.deckCards),
      g.opponentName,
      g.opponentCards,
      g.cardsDrawn,
      g.cardsPlayed,
      g.locations,
    ],
  );
  await db.query(`update trackers set last_upload_at = $1 where id = $2`, [now, tracker.id]);

  return {
    ok: true,
    duplicate: inserted.length === 0,
    game: {
      gameId: g.gameId,
      result: g.result,
      cubes: g.cubes,
      deckName: g.deckName,
      opponentName: g.opponentName,
      league: g.league,
    },
  };
}

export async function deleteTracker(trackerId: number): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query(`delete from tracked_games where tracker_id = $1`, [trackerId]);
    await tx.query(`delete from trackers where id = $1`, [trackerId]);
  });
}
