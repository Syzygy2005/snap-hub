import { getDb } from "@/lib/db";

/**
 * Linking a signed-in account to a leaderboard player row.
 *
 * The board has no player IDs, so there is nothing here to check a claim against: anybody
 * could say they are the rank one player. A claim is therefore private until something
 * vouches for it. A tracker on the same account that has reported playing under that name
 * clears it automatically, and an admin can clear any of them by hand. Until then only the
 * claimant sees it, so an unproved claim buys nothing worth taking.
 *
 * That bar is not cryptographic. A game file comes from the player's own machine, so a
 * determined person could forge the tracker side; it raises the cost rather than closing the
 * door, and an admin can remove any claim.
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
  verifiedAt: r.verified_at ? r.verified_at.toISOString() : null,
  verifiedBy: r.verified_by,
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

  // A tracker on this account that has played under this name is the one piece of evidence
  // available without a person looking, so it clears the claim on the spot.
  const [vouched] = await db.query<{ ok: number }>(
    `select 1 as ok from snap_names where account_id = $1 and name = $2 limit 1`,
    [accountId, player.name],
  );

  await db.query(
    `insert into player_claims (player_id, account_id, verified_at, verified_by)
     values ($1, $2, $3, $4)`,
    [playerId, accountId, vouched ? new Date() : null, vouched ? "tracker" : null],
  );
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

/** Admin confirmation, for somebody who does not run the tracker. */
export async function verifyClaim(playerId: number, now = new Date()): Promise<Claim | null> {
  const db = await getDb();
  const rows = await db.query<{ player_id: number }>(
    `update player_claims set verified_at = $2, verified_by = 'admin'
      where player_id = $1 and verified_at is null returning player_id`,
    [playerId, now],
  );
  if (!rows.length) return null;
  return claimForPlayer(playerId);
}
