import { getPersonalStats, STAT_WINDOWS, type StatWindow } from "@/lib/stats/queries";
import { authenticate, deleteTracker } from "@/lib/stats/tracker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tracker = await authenticate(request);
  if (!tracker) return Response.json({ ok: false, error: "Unknown tracker key" }, { status: 401 });
  const w = new URL(request.url).searchParams.get("window");
  const window: StatWindow = w && w in STAT_WINDOWS ? (w as StatWindow) : "30d";
  return Response.json({ ok: true, stats: await getPersonalStats(tracker, window) });
}

// Removes the key and every game uploaded with it.
export async function DELETE(request: Request) {
  const tracker = await authenticate(request);
  if (!tracker) return Response.json({ ok: false, error: "Unknown tracker key" }, { status: 401 });
  await deleteTracker(tracker.id);
  return Response.json({ ok: true });
}
