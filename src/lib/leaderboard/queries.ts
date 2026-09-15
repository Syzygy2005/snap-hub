import { getDb } from "@/lib/db";
import type { Region } from "@/lib/config";

export interface BoardRow {
  id: number;
  name: string;
  rank: number;
  score: number;
  bestRank: number;
  peakScore: number;
  scoreChangedAt: string;
  /** Rank at the start of the comparison window; null = was off the board. undefined = no data that far back. */
  pastRank?: number | null;
  pastScore?: number | null;
  isNew: boolean;
  sharedName: boolean;
}

export interface BoardMeta {
  season: string;
  region: Region;
  updatedAt: string | null;
  trackingSince: string | null;
  totalPlayers: number | null;
  windowStart: string | null;
}

export async function listSeasons(region: Region): Promise<string[]> {
  const db = await getDb();
  const rows = await db.query<{ season: string }>(
    `select distinct season from standings where region = $1 order by season desc`,
    [region],
  );
  return rows.map((r) => r.season);
}

export async function listRegionsWithData(): Promise<Region[]> {
  const db = await getDb();
  const rows = await db.query<{ region: Region }>(`select distinct region from standings`);
  return rows.map((r) => r.region);
}

async function boardMeta(season: string, region: Region, windowHours: number): Promise<BoardMeta> {
  const db = await getDb();
  const [row] = await db.query<{ updated_at: Date | null; since: Date | null; total: number | null }>(
    `select (select max(taken_at) from snapshots where season = $1 and region = $2) as updated_at,
            (select min(taken_at) from snapshots where season = $1 and region = $2) as since,
            (select total_players from snapshots where season = $1 and region = $2
              order by taken_at desc limit 1) as total`,
    [season, region],
  );
  const updatedAt = row?.updated_at ?? null;
  const windowStart = updatedAt ? new Date(updatedAt.getTime() - windowHours * 3600_000) : null;
  return {
    season,
    region,
    updatedAt: updatedAt?.toISOString() ?? null,
    trackingSince: row?.since?.toISOString() ?? null,
    totalPlayers: row?.total ?? null,
    windowStart: windowStart?.toISOString() ?? null,
  };
}

interface RawBoardRow {
  id: number;
  name: string;
  rank: number;
  score: number;
  best_rank: number;
  peak_score: number;
  score_changed_at: Date;
  first_seen: Date;
  on_board: boolean;
  has_past: boolean;
  past_rank: number | null;
  past_score: number | null;
}

async function rawBoard(season: string, region: Region, windowStart: Date | null, onBoardOnly: boolean) {
  const db = await getDb();
  return db.query<RawBoardRow>(
    `with past as (
       select distinct on (h.player_id) h.player_id, h.rank, h.score
         from history h
        where h.season = $1 and h.region = $2 and h.taken_at <= $3
        order by h.player_id, h.taken_at desc
     )
     select s.player_id as id, p.name, s.rank, s.score, s.best_rank, s.peak_score,
            s.score_changed_at, s.first_seen, s.on_board,
            (past.player_id is not null) as has_past, past.rank as past_rank, past.score as past_score
       from standings s
       join players p on p.id = s.player_id
       left join past on past.player_id = s.player_id
      where s.season = $1 and s.region = $2 and ($4::boolean = false or s.on_board)
      order by s.on_board desc, s.rank`,
    [season, region, windowStart ?? new Date(0), onBoardOnly],
  );
}

function toBoardRows(raw: RawBoardRow[], meta: BoardMeta): BoardRow[] {
  const windowStart = meta.windowStart ? new Date(meta.windowStart) : null;
  const since = meta.trackingSince ? new Date(meta.trackingSince) : null;
  // Only compare when we were already tracking at the start of the window.
  const comparable = !!(windowStart && since && since <= windowStart);

  const nameCounts = new Map<string, number>();
  for (const r of raw) if (r.on_board) nameCounts.set(r.name, (nameCounts.get(r.name) ?? 0) + 1);

  return raw.map((r) => ({
    id: r.id,
    name: r.name,
    rank: r.rank,
    score: r.score,
    bestRank: r.best_rank,
    peakScore: r.peak_score,
    scoreChangedAt: r.score_changed_at.toISOString(),
    pastRank: comparable ? (r.has_past ? r.past_rank : null) : undefined,
    pastScore: comparable ? (r.has_past ? r.past_score : null) : undefined,
    isNew: comparable && !r.has_past,
    sharedName: (nameCounts.get(r.name) ?? 0) > 1,
  }));
}

export async function getBoard(season: string, region: Region, windowHours = 24) {
  const meta = await boardMeta(season, region, windowHours);
  const raw = await rawBoard(season, region, meta.windowStart ? new Date(meta.windowStart) : null, true);
  return { meta, rows: toBoardRows(raw, meta) };
}

export interface Movers {
  meta: BoardMeta;
  comparable: boolean;
  climbers: BoardRow[];
  fallers: BoardRow[];
  newEntries: BoardRow[];
  droppedOut: (BoardRow & { lastRank: number | null })[];
  scoreGainers: BoardRow[];
}

export async function getMovers(season: string, region: Region, windowHours: number, limit = 25): Promise<Movers> {
  const meta = await boardMeta(season, region, windowHours);
  const windowStart = meta.windowStart ? new Date(meta.windowStart) : null;
  const raw = await rawBoard(season, region, windowStart, false);
  const rows = toBoardRows(raw, meta);
  const comparable = rows.some((r) => r.pastRank !== undefined);

  const onBoard = rows.filter((_, i) => raw[i].on_board);
  const withDelta = onBoard.filter((r) => typeof r.pastRank === "number");
  const delta = (r: BoardRow) => (r.pastRank as number) - r.rank;

  const droppedOut = rows
    .map((r, i) => ({ r, raw: raw[i] }))
    .filter(({ r, raw: x }) => !x.on_board && typeof r.pastRank === "number")
    .map(({ r }) => ({ ...r, lastRank: r.pastRank as number }))
    .sort((a, b) => a.lastRank - b.lastRank)
    .slice(0, limit);

  return {
    meta,
    comparable,
    climbers: withDelta.filter((r) => delta(r) > 0).sort((a, b) => delta(b) - delta(a)).slice(0, limit),
    fallers: withDelta.filter((r) => delta(r) < 0).sort((a, b) => delta(a) - delta(b)).slice(0, limit),
    newEntries: onBoard.filter((r) => r.isNew || r.pastRank === null).slice(0, limit),
    droppedOut,
    scoreGainers: onBoard
      .filter((r) => typeof r.pastScore === "number" && r.score !== r.pastScore)
      .sort((a, b) => b.score - (b.pastScore as number) - (a.score - (a.pastScore as number)))
      .slice(0, limit),
  };
}

export interface PlayerSeason {
  season: string;
  region: Region;
  rank: number;
  score: number;
  bestRank: number;
  peakScore: number;
  onBoard: boolean;
  updatedAt: string;
}

export interface HistoryPoint {
  at: string;
  rank: number | null;
  score: number;
}

export async function getPlayer(id: number) {
  const db = await getDb();
  const [player] = await db.query<{ id: number; name: string; first_seen: Date; last_seen: Date }>(
    `select id, name, first_seen, last_seen from players where id = $1`,
    [id],
  );
  if (!player) return null;

  const seasons = await db.query<{
    season: string;
    region: Region;
    rank: number;
    score: number;
    best_rank: number;
    peak_score: number;
    on_board: boolean;
    updated_at: Date;
  }>(
    `select season, region, rank, score, best_rank, peak_score, on_board, updated_at
       from standings where player_id = $1 order by season desc, region`,
    [id],
  );

  const [others] = await db.query<{ n: number }>(
    `select count(*)::int as n from players where name = $1 and id <> $2`,
    [player.name, id],
  );

  return {
    id: player.id,
    name: player.name,
    firstSeen: player.first_seen.toISOString(),
    lastSeen: player.last_seen.toISOString(),
    sameNameCount: others?.n ?? 0,
    seasons: seasons.map<PlayerSeason>((s) => ({
      season: s.season,
      region: s.region,
      rank: s.rank,
      score: s.score,
      bestRank: s.best_rank,
      peakScore: s.peak_score,
      onBoard: s.on_board,
      updatedAt: s.updated_at.toISOString(),
    })),
  };
}

export async function getPlayerHistory(id: number, season: string, region: Region): Promise<HistoryPoint[]> {
  const db = await getDb();
  const rows = await db.query<{ taken_at: Date; rank: number | null; score: number }>(
    `select taken_at, rank, score from history
      where player_id = $1 and season = $2 and region = $3
      order by taken_at`,
    [id, season, region],
  );
  return rows.map((r) => ({ at: r.taken_at.toISOString(), rank: r.rank, score: r.score }));
}

export interface SearchResult {
  id: number;
  name: string;
  lastSeen: string;
  latestSeason: string | null;
  latestRank: number | null;
  latestScore: number | null;
  onBoard: boolean;
}

export async function searchPlayers(q: string, limit = 50): Promise<SearchResult[]> {
  const term = q.trim();
  if (!term) return [];
  const db = await getDb();
  const escaped = term.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await db.query<{
    id: number;
    name: string;
    last_seen: Date;
    season: string | null;
    rank: number | null;
    score: number | null;
    on_board: boolean | null;
  }>(
    `select p.id, p.name, p.last_seen, s.season, s.rank, s.score, s.on_board
       from players p
       left join lateral (
         select season, rank, score, on_board from standings
          where player_id = p.id and region = 'global'
          order by season desc limit 1
       ) s on true
      where lower(p.name) like $1
      order by (lower(p.name) = $2) desc, s.season desc nulls last, s.on_board desc nulls last, s.rank
      limit $3`,
    [`%${escaped}%`, term.toLowerCase(), limit],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    lastSeen: r.last_seen.toISOString(),
    latestSeason: r.season,
    latestRank: r.rank,
    latestScore: r.score,
    onBoard: !!r.on_board,
  }));
}

export async function getLastSnapshot(): Promise<{ at: string } | null> {
  const db = await getDb();
  const [row] = await db.query<{ value: { at: string } }>(`select value from meta where key = 'last_snapshot'`);
  return row?.value ?? null;
}
