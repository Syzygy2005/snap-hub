import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { cleanEnv } from "@/lib/env";
import { deckKey } from "./aggregate";
import { parseGameState, type ParsedGame } from "./parse-game";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export interface Tracker {
  id: number;
  /** A label for the key, so somebody with two PCs can tell them apart. Nothing reads it as
   *  a Snap name: the key is identified by its token and belongs to a Discord account. */
  name: string;
  /** The Discord account this key belongs to, or null for a key made while signed out. */
  account_id?: number | null;
  /** Selected by authenticate so /api/tracker/status needs no second read of the same row. */
  last_upload_at?: Date | null;
}

export type CreateTrackerResult = { ok: true; token: string; tracker: Tracker } | { ok: false; error: string; status: number };

/** Anyone can make a key unless TRACKER_INVITE_CODE is set, in which case they need the code. */
export async function createTracker(
  input: { name?: unknown; inviteCode?: unknown },
  accountId?: number | null,
): Promise<CreateTrackerResult> {
  const required = cleanEnv("TRACKER_INVITE_CODE");
  if (required) {
    const given = Buffer.from(typeof input.inviteCode === "string" ? input.inviteCode.trim() : "");
    const expected = Buffer.from(required);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return { ok: false, error: "That invite code isn't right.", status: 403 };
    }
  }
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 30) : "";
  if (!name) return { ok: false, error: "Give this key a name.", status: 400 };

  const token = `shk_${randomBytes(24).toString("base64url")}`;
  const db = await getDb();
  const [row] = await db.query<Tracker>(
    `insert into trackers (name, token_hash, account_id) values ($1, $2, $3) returning id, name`,
    [name, sha256(token), accountId ?? null],
  );
  return { ok: true, token, tracker: row };
}

export interface LinkedTracker extends Tracker {
  lastUploadAt: string | null;
}

/** Every key on an account. Games from all of them add up on one stats page. */
export async function trackersForAccount(accountId: number): Promise<LinkedTracker[]> {
  const db = await getDb();
  const rows = await db.query<{ id: number; name: string; last_upload_at: Date | null }>(
    `select id, name, last_upload_at from trackers where account_id = $1 order by id`,
    [accountId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, lastUploadAt: r.last_upload_at?.toISOString() ?? null }));
}

export type ClaimResult = { ok: true; tracker: Tracker } | { ok: false; error: string; status: number };

/**
 * Attaches a tracker key to an account. Holding the key is the proof, which is the same bar
 * as reading its stats, so this adds no access. A key already on another account is refused
 * rather than moved, so nobody quietly takes over a key that leaked.
 */
export async function claimTracker(tracker: Tracker, accountId: number): Promise<ClaimResult> {
  const db = await getDb();
  // Check ownership in the write itself: two simultaneous claims must not overwrite each other.
  const [claimed] = await db.query<Tracker>(
    `update trackers set account_id = $1
      where id = $2 and (account_id is null or account_id = $1)
      returning id, name, account_id`,
    [accountId, tracker.id],
  );
  if (claimed) return { ok: true, tracker: claimed };
  const [exists] = await db.query<{ id: number }>(`select id from trackers where id = $1`, [tracker.id]);
  return exists
    ? { ok: false, error: "That key is already on another account.", status: 409 }
    : { ok: false, error: "That tracker key no longer exists.", status: 404 };
}

export function trackerInviteRequired(): boolean {
  return !!cleanEnv("TRACKER_INVITE_CODE");
}

export async function authenticate(request: Request): Promise<Tracker | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(shk_[\w-]{20,})$/.exec(header.trim())?.[1];
  if (!token) return null;
  const db = await getDb();
  const [row] = await db.query<Tracker>(`select id, name, account_id, last_upload_at from trackers where token_hash = $1`, [sha256(token)]);
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
  const accountHash = sha256(`snaphub:${g.accountId || `tracker-${tracker.id}`}`);

  const db = await getDb();

  // What this account calls itself, recorded whether or not the game itself is new. It is the
  // only direct evidence of a rename the site can get, and it costs one upsert.
  if (g.playerName) {
    await db.query(
      `insert into snap_names (account_hash, name, first_seen, last_seen, games, account_id)
       values ($1, $2, $3, $3, 1, $4)
       on conflict (account_hash, name) do update set
         last_seen = greatest(snap_names.last_seen, excluded.last_seen),
         first_seen = least(snap_names.first_seen, excluded.first_seen),
         games = snap_names.games + 1,
         account_id = coalesce(excluded.account_id, snap_names.account_id)`,
      [accountHash, g.playerName, now, tracker.account_id ?? null],
    );
  }

  const inserted = await db.query<{ id: number }>(
    `insert into tracked_games (tracker_id, account_hash, game_id, played_at, league, battle_mode, friendly, result,
                                cubes, final_cube_value, snapped, opponent_snapped, conceded, turns, total_turns,
                                deck_name, deck_cards, deck_key, opponent_name, opponent_cards, cards_drawn,
                                cards_played, locations, board)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::text[], $18, $19,
             $20::text[], $21::text[], $22::text[], $23::text[], $24::jsonb)
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
      // Passed as text and cast, so the same call works on postgres.js and PGlite.
      JSON.stringify(g.board),
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
