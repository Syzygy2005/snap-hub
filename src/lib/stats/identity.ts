import { getDb } from "@/lib/db";

/**
 * Names a Snap account has been seen using, reported by the PC tracker.
 *
 * The leaderboard has no player IDs, so every rename the board detects is inference from
 * scores. A tracker sees the same account play under one name and then another, which is
 * direct evidence and comes with dates.
 *
 * It is not proof. A game file is uploaded by its own client, and the Snap account id arrives
 * in a header the uploader sets, so anyone holding a tracker key could describe an account
 * that is not theirs, including one they only know because they played against them. So these
 * rows are shown to an admin to weigh against what the board did, and are never applied to a
 * public player row on their own. `account_id` records when the reporting key belonged to a
 * signed-in Discord account, which is the one identity here somebody had to prove.
 */

export interface NameSighting {
  name: string;
  firstSeen: string;
  lastSeen: string;
  games: number;
  /** The key that reported it belonged to a signed-in account. */
  signedIn: boolean;
}

interface Row {
  name: string;
  first_seen: Date;
  last_seen: Date;
  games: number;
  signed_in: boolean;
}

const toSighting = (r: Row): NameSighting => ({
  name: r.name,
  firstSeen: r.first_seen.toISOString(),
  lastSeen: r.last_seen.toISOString(),
  games: Number(r.games),
  signedIn: !!r.signed_in,
});

/**
 * Other names used by whoever has played under this one, most recently seen first.
 *
 * A shared name pulls in every account that has used it, which is the point: two accounts
 * answering to one name is exactly the case where the board cannot tell them apart either.
 */
export async function otherNamesUsedWith(name: string): Promise<NameSighting[]> {
  if (!name) return [];
  const db = await getDb();
  const rows = await db.query<Row>(
    `select n.name, n.first_seen, n.last_seen, n.games, (n.account_id is not null) as signed_in
       from snap_names n
      where n.account_hash in (select account_hash from snap_names where name = $1)
        and n.name <> $1
      order by n.last_seen desc, n.name`,
    [name],
  );
  return rows.map(toSighting);
}

/** Every name the signed-in person's own keys have reported, most recent first. */
export async function myTrackedNames(accountId: number): Promise<NameSighting[]> {
  const db = await getDb();
  const rows = await db.query<Row>(
    `select name, first_seen, last_seen, games, true as signed_in
       from snap_names where account_id = $1 order by last_seen desc, name`,
    [accountId],
  );
  return rows.map(toSighting);
}
