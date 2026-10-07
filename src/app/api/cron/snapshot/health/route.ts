import { cleanEnv } from "@/lib/env";
import { getSnapshotHealth } from "@/lib/leaderboard/health";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = cleanEnv("CRON_SECRET");
  if (secret ? request.headers.get("authorization")?.trim() !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const health = await getSnapshotHealth();
    return Response.json(health, {
      status: health.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[snapshot health] failed", error);
    return Response.json({ ok: false, error: "Could not check leaderboard freshness; inspect the server log." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
