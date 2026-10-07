import { runSnapshot } from "@/lib/leaderboard/ingest";
import { describeDbError } from "@/lib/db/errors";
import { cleanEnv } from "@/lib/env";
import { getSnapshotHealth, snapshotRunSucceeded } from "@/lib/leaderboard/health";

export const dynamic = "force-dynamic";
export const maxDuration = 60;


// Called every ~10 minutes by the GitHub Actions workflow (production) or every 30 by the dev scheduler.
export async function GET(request: Request) {
  const secret = cleanEnv("CRON_SECRET");
  const authorized = secret
    ? request.headers.get("authorization")?.trim() === `Bearer ${secret}`
    : process.env.NODE_ENV !== "production";
  if (!authorized) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const leaderboard = await runSnapshot();
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
