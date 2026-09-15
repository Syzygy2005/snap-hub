import { runSnapshot } from "@/lib/leaderboard/ingest";
import { cardsSyncedAt, syncCards } from "@/lib/cards/sync";
import { describeDbError } from "@/lib/db/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CARD_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

// Called every ~30 minutes by the GitHub Actions workflow (production) or the dev scheduler.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : process.env.NODE_ENV !== "production";
  if (!authorized) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const leaderboard = await runSnapshot();

    let cards: unknown = "skipped";
    const forceCards = new URL(request.url).searchParams.get("cards") === "1";
    const lastSync = await cardsSyncedAt();
    if (forceCards || !lastSync || Date.now() - lastSync.getTime() > CARD_SYNC_INTERVAL_MS) {
      try {
        cards = await syncCards();
      } catch (err) {
        cards = { error: String(err) };
      }
    }

    return Response.json({ ok: true, leaderboard, cards });
  } catch (err) {
    console.error("[snapshot] failed", err);
    return Response.json({ ok: false, error: describeDbError(err) }, { status: 500 });
  }
}
