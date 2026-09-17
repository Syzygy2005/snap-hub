import { getDb } from "@/lib/db";

/**
 * Joins two player rows that are really one person under two names.
 *
 * Renames are caught at ingest now, but rows split before that fix exists, and the rule
 * only fires when the score held still, so this stays as the repair for the rest. It is
 * destructive and one-way, which is why nothing calls it automatically.
 */

export interface MergePlan {
  keep: { id: number; name: string };
  absorb: { id: number; name: string; lastSeen: string };
  historyRows: number;
  /** Seasons only the absorbed row has: they move across untouched. */
  seasonsMoved: { season: string; region: string }[];
  /** Seasons both rows have: the later reading wins, with best rank and peak taken across both. */
  seasonsCombined: { season: string; region: string }[];
}

export type PlanResult = { ok: true; plan: MergePlan } | { ok: false; error: string };

interface PlayerRow {
  id: number;
  name: string;
  last_seen: Date;
}

export async function planMerge(keepId: number, absorbId: number): Promise<PlanResult> {
  if (keepId === absorbId) return { ok: false, error: "Those are the same player." };
  const db = await getDb();

  const rows = await db.query<PlayerRow>(`select id, name, last_seen from players where id = any($1::int[])`, [
    [keepId, absorbId],
  ]);
  const keep = rows.find((r) => r.id === keepId);
  const absorb = rows.find((r) => r.id === absorbId);
  if (!keep) return { ok: false, error: `No player with id ${keepId}.` };
  if (!absorb) return { ok: false, error: `No player with id ${absorbId}.` };

  // The safety check: one person cannot hold two ranks in the same snapshot. A rank of null
  // is a "left the board" marker rather than a position, so those are not a contradiction.
  const [clash] = await db.query<{ taken_at: Date; season: string; region: string }>(
    `select h1.taken_at, h1.season, h1.region
       from history h1
       join history h2
         on h1.season = h2.season and h1.region = h2.region and h1.taken_at = h2.taken_at
      where h1.player_id = $1 and h2.player_id = $2
        and h1.rank is not null and h2.rank is not null
      limit 1`,
    [keepId, absorbId],
  );
  if (clash) {
    return {
      ok: false,
      error:
        `${keep.name} and ${absorb.name} were both on the board at ` +
        `${clash.taken_at.toISOString()} (${clash.season} ${clash.region}), so they are two different people.`,
    };
  }

  const [{ n: historyRows }] = await db.query<{ n: number }>(
    `select count(*)::int as n from history where player_id = $1`,
    [absorbId],
  );
  const overlap = await db.query<{ season: string; region: string; both: boolean }>(
    `select a.season, a.region, (k.player_id is not null) as both
       from standings a
       left join standings k on k.season = a.season and k.region = a.region and k.player_id = $1
      where a.player_id = $2
      order by a.season desc, a.region`,
    [keepId, absorbId],
  );

  return {
    ok: true,
    plan: {
      keep: { id: keep.id, name: keep.name },
      absorb: { id: absorb.id, name: absorb.name, lastSeen: absorb.last_seen.toISOString() },
      historyRows,
      seasonsMoved: overlap.filter((o) => !o.both).map((o) => ({ season: o.season, region: o.region })),
      seasonsCombined: overlap.filter((o) => o.both).map((o) => ({ season: o.season, region: o.region })),
    },
  };
}

export async function applyMerge(plan: MergePlan): Promise<void> {
  const db = await getDb();
  const keepId = plan.keep.id;
  const absorbId = plan.absorb.id;

  await db.transaction(async (tx) => {
    // Keep the name they used, so the profile can still show where the history came from.
    await tx.query(`insert into player_names (player_id, name, changed_at) values ($1, $2, $3)`, [
      keepId,
      plan.absorb.name,
      new Date(plan.absorb.lastSeen),
    ]);

    // Seasons both rows have: the later reading is the truth, but bests span both lives.
    await tx.query(
      `update standings k set
         rank = case when a.updated_at > k.updated_at then a.rank else k.rank end,
         score = case when a.updated_at > k.updated_at then a.score else k.score end,
         on_board = case when a.updated_at > k.updated_at then a.on_board else k.on_board end,
         updated_at = greatest(k.updated_at, a.updated_at),
         best_rank = least(k.best_rank, a.best_rank),
         peak_score = greatest(k.peak_score, a.peak_score),
         first_seen = least(k.first_seen, a.first_seen),
         score_changed_at = greatest(k.score_changed_at, a.score_changed_at),
         history_at = greatest(k.history_at, a.history_at)
       from standings a
      where a.player_id = $2 and k.player_id = $1
        and a.season = k.season and a.region = k.region`,
      [keepId, absorbId],
    );
    await tx.query(
      `delete from standings a
        where a.player_id = $2
          and exists (select 1 from standings k
                       where k.player_id = $1 and k.season = a.season and k.region = a.region)`,
      [keepId, absorbId],
    );

    // Whatever is left belongs to seasons the keeper never had, so it moves as is.
    await tx.query(`update standings set player_id = $1 where player_id = $2`, [keepId, absorbId]);
    await tx.query(`update history set player_id = $1 where player_id = $2`, [keepId, absorbId]);
    await tx.query(`update player_names set player_id = $1 where player_id = $2`, [keepId, absorbId]);

    await tx.query(
      `update players set first_seen = least(first_seen, $2), last_seen = greatest(last_seen, $3) where id = $1`,
      [keepId, new Date(plan.absorb.lastSeen), new Date(plan.absorb.lastSeen)],
    );
    await tx.query(`delete from players where id = $1`, [absorbId]);
  });
}
