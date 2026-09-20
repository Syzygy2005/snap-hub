import { getDb, type Db } from "@/lib/db";
import { RANK_DRIFT_INTERVAL_MS, trackedRegions, type Region } from "@/lib/config";
import { currentSeason, previousSeason, seasonKey, type SeasonRef } from "@/lib/season";
import { fetchBoard, type BoardEntry } from "./fetch";
import { detectRenames, matchEntries } from "./match";

export interface IngestSummary {
  season: string;
  region: Region;
  status: "updated" | "unchanged" | "unavailable" | "error" | "skipped";
  entries?: number;
  changed?: number;
  newPlayers?: number;
  renamed?: number;
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

    // A rename looks like a departure and an arrival in the same tick. Catch it here, before
    // anything decides the arrival is a new player, so the history stays on one row.
    const claimed = new Set(ids.filter((id): id is number => id !== null));
    const renames = detectRenames(
      known
        .filter((k) => k.on_board && !claimed.has(k.player_id))
        .map((k) => ({ playerId: k.player_id, name: k.name, score: k.score, rank: k.rank })),
      ids.flatMap((id, i) =>
        id === null ? [{ index: i, name: entries[i].name, score: entries[i].score, rank: entries[i].rank }] : [],
      ),
      {
        onBoard: new Set(entries.map((e) => e.name)),
        known: new Set(known.map((k) => k.name)),
        shared: await sharedNames(tx, season, region, entries),
        cutScore: Math.min(...entries.map((e) => e.score)),
        maxDrop: await largestDrop(tx, season, region),
      },
    );
    for (const r of renames) {
      ids[r.index] = r.playerId;
      await tx.query(`update players set name = $1, last_seen = $2 where id = $3`, [r.to, now, r.playerId]);
      await tx.query(`insert into player_names (player_id, name, changed_at) values ($1, $2, $3)`, [
        r.playerId,
        r.from,
        now,
      ]);
    }

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
      // A rename on its own moves nothing, but it has already been written in this transaction.
      return { season, region, status: "unchanged", entries: entries.length, changed: 0, renamed: renames.length } as const;
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
      renamed: renames.length,
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

/**
 * The largest score loss this season has actually shown, between one sighting of a player and
 * the next. A departure's stored score is their last sighting, so it can sit well above the cut
 * while the player really did fall under it: they lost cubes and dropped off in the same gap.
 * Discounting by what a player can genuinely lose is what separates that from a rename.
 *
 * Read from the season's own history rather than fixed, so it reflects this board rather than
 * the one it happened to be measured on. Empty history gives 0, which is simply the weaker rule.
 */
async function largestDrop(tx: Db, season: string, region: Region): Promise<number> {
  const [row] = await tx.query<{ drop: number | null }>(
    `select max(fell) as drop from (
       select lag(score) over (partition by player_id order by taken_at) - score as fell
         from history where season = $1 and region = $2 and rank is not null
     ) steps where fell > 0`,
    [season, region],
  );
  return Number(row?.drop ?? 0) || 0;
}

/**
 * Names that more than one player has carried this season, counting the names they have since
 * renamed away from, together with any name sitting on the board twice right now.
 *
 * Default names are the reason this exists. Only a few players carry one at a time and they
 * churn, so the name leaves the board outright every so often, and a tick where it is absent
 * used to look exactly like the one person who owned it walking away.
 */
async function sharedNames(
  tx: Db,
  season: string,
  region: Region,
  entries: BoardEntry[],
): Promise<Set<string>> {
  const rows = await tx.query<{ name: string }>(
    `select name from (
       select p.name as name, s.player_id as player_id
         from standings s join players p on p.id = s.player_id
        where s.season = $1 and s.region = $2
       union
       select pn.name, s.player_id
         from standings s join player_names pn on pn.player_id = s.player_id
        where s.season = $1 and s.region = $2
     ) held
     group by name having count(distinct player_id) > 1`,
    [season, region],
  );
  const shared = new Set(rows.map((r) => r.name));

  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.name)) shared.add(e.name);
    seen.add(e.name);
  }
  return shared;
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

/** Marks a finished season whose final board is stored, so it is never fetched again. */
const closedKey = (season: string, region: Region) => `season_closed:${season}:${region}`;

async function fetchAndIngest(db: Db, ref: SeasonRef, region: Region, now: Date): Promise<IngestSummary> {
  const result = await fetchBoard(ref, region);
  if (!result.ok) return { season: seasonKey(ref), region, status: result.reason, detail: result.detail };
  try {
    return await ingestBoard(db, ref, region, result.entries, result.total, now);
  } catch (err) {
    return { season: seasonKey(ref), region, status: "error", detail: String(err) };
  }
}

/**
 * Fetch and store the boards worth fetching.
 *
 * The current month moves all day. The previous month cannot move at all, so it is fetched
 * once after it ends and then left alone, instead of being pulled every tick for a board
 * that is already final. Until that one fetch lands it keeps being retried, so a site that
 * was asleep over the turn of the month still captures the finished board.
 *
 * It is closed only once the new month has a board of its own. Whether the official
 * leaderboard freezes the old month exactly at UTC midnight is not something this code
 * knows, and guessing a settling period would be inventing a number, so it waits for proof
 * instead: the moment anybody has reached Infinite in the new month, the old one is over.
 * The cost of that is a few extra fetches on the first of the month and nothing after.
 */
export async function runSnapshot(now = new Date()): Promise<IngestSummary[]> {
  const db = await getDb();
  const cur = currentSeason(now);
  const prev = previousSeason(cur);
  const curKey = seasonKey(cur);
  const prevKey = seasonKey(prev);
  const summaries: IngestSummary[] = [];

  for (const region of trackedRegions()) {
    summaries.push(await fetchAndIngest(db, cur, region, now));

    const closed = await db.query(`select 1 from meta where key = $1`, [closedKey(prevKey, region)]);
    if (closed.length) {
      summaries.push({ season: prevKey, region, status: "skipped", detail: "Final board already stored." });
      continue;
    }

    const previous = await fetchAndIngest(db, prev, region, now);
    summaries.push(previous);
    if (previous.status !== "updated" && previous.status !== "unchanged") continue;

    const started = await db.query(`select 1 from standings where season = $1 and region = $2 limit 1`, [
      curKey,
      region,
    ]);
    if (!started.length) continue;
    await db.query(
      `insert into meta (key, value, updated_at) values ($1, $2, $3) on conflict (key) do nothing`,
      [closedKey(prevKey, region), JSON.stringify({ at: now.toISOString() }), now],
    );
  }

  await db.query(
    `insert into meta (key, value, updated_at) values ('last_snapshot', $1, $2)
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify({ at: now.toISOString(), summaries }), now],
  );
  return summaries;
}
