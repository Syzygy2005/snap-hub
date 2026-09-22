import { getDb } from "@/lib/db";

/**
 * Linking a signed-in account to a leaderboard player row.
 *
 * The board has no player IDs, so there is nothing here to check a claim against: anybody
 * could say they are the rank one player. Only an admin can confirm a claim for public
 * display. Tracker names are client-controlled and non-unique, so they are supporting
 * evidence for moderation, never proof of ownership. Until confirmation, only the claimant
 * and admins may receive the claim, including in Client Component props.
 */

export interface Claim {
  playerId: number;
  playerName: string;
  accountId: number;
  username: string;
  claimedAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

interface Row {
  player_id: number;
  player_name: string;
  account_id: number;
  username: string;
  claimed_at: Date;
  verified_at: Date | null;
  verified_by: string | null;
}

const SELECT = `select c.player_id, p.name as player_name, c.account_id, a.username,
                       c.claimed_at, c.verified_at, c.verified_by
                  from player_claims c
                  join players p on p.id = c.player_id
                  join accounts a on a.id = c.account_id`;

const toClaim = (r: Row): Claim => ({
  playerId: r.player_id,
  playerName: r.player_name,
  accountId: r.account_id,
  username: r.username,
  claimedAt: r.claimed_at.toISOString(),
  // Fail closed for legacy tracker confirmations too. Keep the stored evidence for admins,
  // but every reader treats it as pending until an admin confirms it.
  verifiedAt: r.verified_by === "admin" && r.verified_at ? r.verified_at.toISOString() : null,
  verifiedBy: r.verified_by === "admin" && r.verified_at ? "admin" : null,
});

export async function claimForPlayer(playerId: number): Promise<Claim | null> {
  const db = await getDb();
  const [row] = await db.query<Row>(`${SELECT} where c.player_id = $1`, [playerId]);
  return row ? toClaim(row) : null;
}

export async function claimForAccount(accountId: number): Promise<Claim | null> {
  const db = await getDb();
  const [row] = await db.query<Row>(`${SELECT} where c.account_id = $1`, [accountId]);
  return row ? toClaim(row) : null;
}

/** The only claim fields the browser needs; account ids and claim dates stay server-side. */
export type ClaimView = Pick<Claim, "username" | "verifiedAt">;

/** Apply visibility before a claim crosses the Server/Client Component boundary. */
export async function claimForViewer(
  playerId: number,
  accountId: number | null,
  admin: boolean,
): Promise<{ claim: ClaimView | null; mine: boolean }> {
  const claim = await claimForPlayer(playerId);
  const mine = accountId !== null && claim?.accountId === accountId;
  if (!claim || (!claim.verifiedAt && !mine && !admin)) return { claim: null, mine: false };
  return { claim: { username: claim.username, verifiedAt: claim.verifiedAt }, mine };
}

export type ClaimResult = { ok: true; claim: Claim } | { ok: false; error: string; status: number };

export async function claimPlayer(playerId: number, accountId: number): Promise<ClaimResult> {
  const db = await getDb();
  const [player] = await db.query<{ name: string }>(`select name from players where id = $1`, [playerId]);
  if (!player) return { ok: false, error: "No such player.", status: 404 };

  const taken = await claimForPlayer(playerId);
  if (taken) {
    return taken.accountId === accountId
      ? { ok: true, claim: taken }
      : { ok: false, error: "Somebody has already claimed that player.", status: 409 };
  }
  const mine = await claimForAccount(accountId);
  if (mine) {
    return {
      ok: false,
      error: `You have already claimed ${mine.playerName}. Release that one first.`,
      status: 409,
    };
  }

  // Claim in the write itself, the way claimTracker does. The reads above are for the error
  // messages, not the decision: two people pressing "This is me" on the same player in the same
  // moment both saw nothing taken, both inserted, and the loser hit the player_id primary key
  // with an exception that escaped the route as a 500 instead of the 409 written above. One
  // account claiming two players races the same way on player_claims_account_idx.
  const [inserted] = await db.query<{ player_id: number }>(
    `insert into player_claims (player_id, account_id) values ($1, $2)
     on conflict do nothing returning player_id`,
    [playerId, accountId],
  );
  if (!inserted) {
    const now = await claimForPlayer(playerId);
    if (now?.accountId === accountId) return { ok: true, claim: now };
    if (now) return { ok: false, error: "Somebody has already claimed that player.", status: 409 };
    const other = await claimForAccount(accountId);
    return other
      ? { ok: false, error: `You have already claimed ${other.playerName}. Release that one first.`, status: 409 }
      : { ok: false, error: "Could not save that claim.", status: 500 };
  }
  const claim = await claimForPlayer(playerId);
  return claim ? { ok: true, claim } : { ok: false, error: "Could not save that claim.", status: 500 };
}

/** Removes a claim. An account may only remove its own; an admin may remove any. */
export async function releaseClaim(playerId: number, accountId: number | null): Promise<boolean> {
  const db = await getDb();
  const rows = accountId === null
    ? await db.query<{ player_id: number }>(
        `delete from player_claims where player_id = $1 returning player_id`,
        [playerId],
      )
    : await db.query<{ player_id: number }>(
        `delete from player_claims where player_id = $1 and account_id = $2 returning player_id`,
        [playerId, accountId],
      );
  return rows.length > 0;
}

/** Admin confirmation, including claims previously confirmed only by a tracker. */
export async function verifyClaim(playerId: number, now = new Date()): Promise<Claim | null> {
  const db = await getDb();
  const rows = await db.query<{ player_id: number }>(
    `update player_claims set verified_at = $2, verified_by = 'admin'
      where player_id = $1 and (verified_at is null or verified_by is distinct from 'admin')
      returning player_id`,
    [playerId, now],
  );
  if (!rows.length) return null;
  return claimForPlayer(playerId);
}
