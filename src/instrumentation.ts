// Local development only: take a leaderboard snapshot on startup and every 30 minutes
// while `npm run dev` is running. Production uses the GitHub Actions workflow instead.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "development" || process.env.DISABLE_DEV_SCHEDULER === "1") return;

  const g = globalThis as unknown as { __snapScheduler?: boolean };
  if (g.__snapScheduler) return;
  g.__snapScheduler = true;

  const port = process.env.PORT ?? "3100";
  const run = async () => {
    try {
      const res = await fetch(`http://localhost:${port}/api/cron/snapshot`, {
        headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {},
      });
      const body = (await res.json()) as { leaderboard?: { season: string; status: string; changed?: number }[] };
      const summary = body.leaderboard?.map((s) => `${s.season} ${s.status}${s.changed ? ` (${s.changed})` : ""}`);
      console.log(`[snapshot] ${summary?.join(", ") ?? res.status}`);
    } catch (err) {
      console.warn("[snapshot] failed:", err);
    }
  };

  setTimeout(run, 5_000);
  setInterval(run, 30 * 60 * 1000);
}
