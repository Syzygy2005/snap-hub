import { getPlayerRecords } from "@/lib/leaderboard/queries";
import { MAX_WATCHED } from "@/lib/leaderboard/watchlist";

export const dynamic = "force-dynamic";

/**
 * `?ids=1,2,3`: the name and first sighting of each player that exists, for the watchlist a
 * browser keeps. Everything here is on the public profiles already. It reads this site's own
 * database and nothing else, so it adds no request to the official board.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const parts = raw.split(",").filter(Boolean);
  if (parts.length === 0) return Response.json({ ok: false, error: "No ids" }, { status: 400 });
  if (parts.length > MAX_WATCHED) {
    return Response.json({ ok: false, error: `At most ${MAX_WATCHED} ids` }, { status: 400 });
  }
  if (!parts.every((p) => /^\d{1,9}$/.test(p) && Number(p) > 0)) {
    return Response.json({ ok: false, error: "Ids are whole numbers" }, { status: 400 });
  }
  const players = await getPlayerRecords([...new Set(parts.map(Number))]);
  return Response.json({ ok: true, players }, { headers: { "Cache-Control": "no-store" } });
}
