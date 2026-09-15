import { getDb, type Db } from "@/lib/db";
import { RANK_DRIFT_INTERVAL_MS, trackedRegions, type Region } from "@/lib/config";
import { currentSeason, previousSeason, seasonKey, type SeasonRef } from "@/lib/season";
import { fetchBoard, type BoardEntry } from "./fetch";
import { matchEntries } from "./match";

export interface IngestSummary {
  season: string;
  region: Region;
  status: "updated" | "unchanged" | "unavailable" | "error";
  entries?: number;
  changed?: number;
  newPlayers?: number;
  left?: number;
  detail?: string;
}

interface KnownRow {
  player_id: number;
  name: string;
  rank: number;
  score: number;
  on_board: boolean;
  history_at: Date;
}

export async function ingestBoard(
  db: Db,
  ref: SeasonRef,
  region: Region,
  entries: BoardEntry[],
  total: number | null,
  now: Date,
): Promise<IngestSummary> {
  const season = seasonKey(ref);

  return db.transaction(async (tx) => {
    const known = await tx.query<KnownRow>(
      `select s.player_id, p.name, s.rank, s.score, s.on_board, s.history_at
         from standings s join players p on p.id = s.player_id
        where s.season = $1 and s.region = $2`,
      [season, region],
    );
    const knownById = new Map(known.map((k) => [k.player_id, k]));

    const ids = matchEntries(
      entries,
      known.map((k) => ({ playerId: k.player_id, name: k.name, score: k.score })),
    );

    // Players new to this season: reuse a player from an earlier season with the same name, else create one.
    const unmatched = ids.flatMap((id, i) => (id === null ? [i] : []));
    let newPlayers = 0;
    if (unmatched.length) {
      const names = [...new Set(unmatched.map((i) => entries[i].name))];
      const earlier = await tx.query<{ id: number; name: string }>(
        `select p.id, p.name from players p
          where p.name = any($1::text[])
            and not exists (select 1 from standings s
                             where s.player_id = p.id and s.season = $2 and s.region = $3)
          order by p.last_seen desc`,
        [names, season, region],
      );
      const pool = groupIds(earlier);

      const toCreate: number[] = [];
      for (const i of unmatched) {
        const reuse = pool.get(entries[i].name)?.shift();
        if (reuse !== undefined) ids[i] = reuse;
        else toCreate.push(i);
      }

      if (toCreate.length) {
        const created = await tx.query<{ id: number; name: string }>(
          `insert into players (name, first_seen, last_seen)
           select n, $2, $2 from unnest($1::text[]) as u(n)
           returning id, name`,
          [toCreate.map((i) => entries[i].name), now],
        );
        const fresh = groupIds(created);
        for (const i of toCreate) ids[i] = fresh.get(entries[i].name)!.shift()!;
      }
      newPlayers = unmatched.length;
    }

    const playerIds = ids as number[];
    const onBoardNow = new Set(playerIds);

    const writeHistory: boolean[] = [];
    const history: { id: number; rank: number | null; score: number }[] = [];
    let changed = 0;

    entries.forEach((e, i) => {
      const prev = knownById.get(playerIds[i]);
      const moved = !prev || !prev.on_board || prev.score !== e.score || prev.rank !== e.rank;
      if (moved) changed++;

      const write =
        !prev ||
        !prev.on_board ||
        prev.score !== e.score ||
        (prev.rank !== e.rank && now.getTime() - prev.history_at.getTime() >= RANK_DRIFT_INTERVAL_MS);
      writeHistory.push(write);
      if (write) history.push({ id: playerIds[i], rank: e.rank, score: e.score });
    });

    const left = known.filter((k) => k.on_board && !onBoardNow.has(k.player_id));
    for (const k of left) history.push({ id: k.player_id, rank: null, score: k.score });

    if (changed === 0 && left.length === 0) {
      return { season, region, status: "unchanged", entries: entries.length, changed: 0 } as const;
    }

    await tx.query(
      `insert into standings (season, region, player_id, rank, score, best_rank, peak_score, on_board,
                              first_seen, updated_at, score_changed_at, history_at)
       select $1, $2, u.p, u.r, u.s, u.r, u.s, true, $3, $3, $3,
              case when u.h then $3::timestamptz else '-infinity'::timestamptz end
         from unnest($4::int[], $5::int[], $6::int[], $7::bool[]) as u(p, r, s, h)
       on conflict (season, region, player_id) do update set
         rank = excluded.rank,
         score = excluded.score,
         best_rank = least(standings.best_rank, excluded.rank),
         peak_score = greatest(standings.peak_score, excluded.score),
         on_board = true,
         updated_at = excluded.updated_at,
         score_changed_at = case when standings.score <> excluded.score or not standings.on_board
                                 then excluded.updated_at else standings.score_changed_at end,
         history_at = greatest(standings.history_at, excluded.history_at)`,
      [
        season,
        region,
        now,
        playerIds,
        entries.map((e) => e.rank),
        entries.map((e) => e.score),
        writeHistory,
      ],
    );

    if (left.length) {
      await tx.query(
        `update standings set on_board = false, history_at = $3
          where season = $1 and region = $2 and player_id = any($4::int[])`,
        [season, region, now, left.map((k) => k.player_id)],
      );
    }

    if (history.length) {
      await tx.query(
        `insert into history (player_id, season, region, taken_at, rank, score)
         select u.p, $1, $2, $3, u.r, u.s from unnest($4::int[], $5::int[], $6::int[]) as u(p, r, s)`,
        [
          season,
          region,
          now,
          history.map((h) => h.id),
          history.map((h) => h.rank),
          history.map((h) => h.score),
        ],
      );
    }

    await tx.query(`update players set last_seen = $1 where id = any($2::int[])`, [now, playerIds]);
    await tx.query(
      `insert into snapshots (season, region, taken_at, total_players, entries, changed)
       values ($1, $2, $3, $4, $5, $6)`,
      [season, region, now, total, entries.length, changed],
    );

    return {
      season,
      region,
      status: "updated",
      entries: entries.length,
      changed,
      newPlayers,
      left: left.length,
    } as const;
  });
}

function groupIds(rows: { id: number; name: string }[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const r of rows) {
    const list = map.get(r.name);
    if (list) list.push(r.id);
    else map.set(r.name, [r.id]);
  }
  return map;
}

/** Fetch and store the current and previous month for every tracked region. */
export async function runSnapshot(now = new Date()): Promise<IngestSummary[]> {
  const db = await getDb();
  const cur = currentSeason(now);
  const seasons = [cur, previousSeason(cur)];
  const summaries: IngestSummary[] = [];

  for (const region of trackedRegions()) {
    for (const ref of seasons) {
      const result = await fetchBoard(ref, region);
      if (!result.ok) {
        summaries.push({ season: seasonKey(ref), region, status: result.reason, detail: result.detail });
        continue;
      }
      try {
        summaries.push(await ingestBoard(db, ref, region, result.entries, result.total, now));
      } catch (err) {
        summaries.push({ season: seasonKey(ref), region, status: "error", detail: String(err) });
      }
    }
  }

  await db.query(
    `insert into meta (key, value, updated_at) values ('last_snapshot', $1, $2)
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify({ at: now.toISOString(), summaries }), now],
  );
  return summaries;
}
