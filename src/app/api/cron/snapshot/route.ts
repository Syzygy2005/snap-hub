import { runSnapshot } from "@/lib/leaderboard/ingest";
import { describeDbError } from "@/lib/db/errors";
import { cleanEnv } from "@/lib/env";
import { getSnapshotHealth, snapshotRunSucceeded } from "@/lib/leaderboard/health";
import { withSnapshotLease } from "@/lib/leaderboard/lease";

export const dynamic = "force-dynamic";
export const maxDuration = 60;


// Called every 10 minutes by Vercel Cron (vercel.json) in production, or every 30 by the dev
// scheduler. GitHub Actions calls it only by hand or when the freshness monitor finds a board
// stale. Any of those can land at the same moment as a cron run, so the run holds a lease and a
// call that finds one held does nothing.
export async function GET(request: Request) {
  const secret = cleanEnv("CRON_SECRET");
  const authorized = secret
    ? request.headers.get("authorization")?.trim() === `Bearer ${secret}`
    : process.env.NODE_ENV !== "production";
  if (!authorized) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const run = await withSnapshotLease(() => runSnapshot());
    if (!run.ran) {
      // Not a failure: the run already underway is doing this work, and the freshness monitor
      // still catches a board that stops refreshing, since it reads board_checked, not this.
      return Response.json(
        { ok: true, skipped: "Another snapshot is already running.", runningSince: run.heldSince },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const leaderboard = run.value;
    const health = await getSnapshotHealth();
    const ok = snapshotRunSucceeded(leaderboard, health);
    return Response.json({ ok, leaderboard, health }, {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[snapshot] failed", err);
    return Response.json({ ok: false, error: describeDbError(err) }, { status: 500 });
  }
}
