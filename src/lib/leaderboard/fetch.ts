import type { Region } from "@/lib/config";
import type { SeasonRef } from "@/lib/season";

const API = "https://marvelsnap.com/wp-json/api/v1/leaderboard";

export interface BoardEntry {
  rank: number; // 1-based
  name: string;
  score: number;
}

export type FetchResult =
  | { ok: true; total: number | null; entries: BoardEntry[] }
  | { ok: false; reason: "unavailable" | "error"; detail: string };

interface ApiResponse {
  total?: number;
  results?: unknown[];
  code?: string;
  message?: string;
}

/**
 * Fetch one month's Infinite board. The API only serves the current and previous month,
 * returns the top 1000 players, and has no player IDs.
 */
export async function fetchBoard(season: SeasonRef, region: Region): Promise<FetchResult> {
  const url = `${API}?month=${season.month}&year=${season.year}&region=${region}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SnapHub fan leaderboard tracker)" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }

  const text = await res.text();
  let body: ApiResponse;
  try {
    body = JSON.parse(text);
  } catch {
    // A warning page is a failed check, not evidence that a season has not started.
    return { ok: false, reason: "error", detail: `Non-JSON response (${res.status})` };
  }

  if (body.code === "invalid_month" && (res.ok || res.status === 400)) {
    return { ok: false, reason: "unavailable", detail: body.message ?? "invalid_month" };
  }
  if (!res.ok) {
    return { ok: false, reason: "error", detail: `Source returned HTTP ${res.status}` };
  }
  if (!Array.isArray(body.results)) {
    return { ok: false, reason: "error", detail: `Unexpected response (${res.status})` };
  }
  if (body.results.length === 0) {
    return { ok: false, reason: "unavailable", detail: "Empty board" };
  }

  const entries: BoardEntry[] = [];
  const bad: string[] = [];
  body.results.forEach((r, i) => {
    const row = readRow(r);
    if (typeof row === "string") bad.push(`row ${i} ${row}`);
    else entries.push(row);
  });
  if (bad.length) {
    return { ok: false, reason: "error", detail: `Malformed board: ${bad.length} of ${body.results.length} rows, first ${bad[0]}` };
  }
  entries.sort((a, b) => a.rank - b.rank);

  return { ok: true, total: typeof body.total === "number" ? body.total : null, entries };
}

const show = (v: unknown) => (JSON.stringify(v) ?? String(v)).slice(0, 40);

/**
 * One row of the board, or what is wrong with it. A single bad row fails the whole board.
 * Dropping it, which this used to do, is not harmless: a player missing from the board reads
 * as a departure, departures are what rename detection pairs, and a wrong pairing joins two
 * strangers for good. A board whose every row was bad came back as a successful empty one,
 * so everybody left, the next run found nothing changed, and `board_checked` kept the
 * freshness monitor green on an empty board. Rank was never checked, and `"10" + 1` is
 * `"101"`. Failing keeps the last good board, leaves `board_checked` where it was, and makes
 * the snapshot route answer 503, so a source that changes its format is seen, not absorbed.
 */
function readRow(r: unknown): BoardEntry | string {
  if (!r || typeof r !== "object") return `is ${show(r)}`;
  const { rank, playerName, score } = r as Record<string, unknown>;
  if (typeof rank !== "number" || !Number.isInteger(rank) || rank < 0) return `has rank ${show(rank)}`;
  if (typeof playerName !== "string") return `has playerName ${show(playerName)}`;
  if (typeof score !== "number" || !Number.isInteger(score)) return `has score ${show(score)}`;
  return { rank: rank + 1, name: playerName, score };
}
