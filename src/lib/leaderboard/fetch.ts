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
  results?: { rank: number; playerName: string; score: number }[];
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
    // Unsupported regions come back as a PHP warning page instead of JSON.
    return { ok: false, reason: "unavailable", detail: `Non-JSON response (${res.status})` };
  }

  if (body.code === "invalid_month") {
    return { ok: false, reason: "unavailable", detail: body.message ?? "invalid_month" };
  }
  if (!Array.isArray(body.results)) {
    return { ok: false, reason: "error", detail: `Unexpected response (${res.status})` };
  }
  if (body.results.length === 0) {
    return { ok: false, reason: "unavailable", detail: "Empty board" };
  }

  const entries = body.results
    .filter((r) => typeof r.playerName === "string" && Number.isFinite(r.score))
    .map((r) => ({ rank: r.rank + 1, name: r.playerName, score: r.score }))
    .sort((a, b) => a.rank - b.rank);

  return { ok: true, total: typeof body.total === "number" ? body.total : null, entries };
}
