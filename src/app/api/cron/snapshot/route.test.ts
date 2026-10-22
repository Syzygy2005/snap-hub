import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runSnapshot } from "@/lib/leaderboard/ingest";
import { getSnapshotHealth } from "@/lib/leaderboard/health";
import { getDb } from "@/lib/db";
import { GET } from "./route";

vi.mock("@/lib/leaderboard/ingest", () => ({ runSnapshot: vi.fn() }));
vi.mock("@/lib/leaderboard/health", async (original) => ({
  ...await original<typeof import("@/lib/leaderboard/health")>(),
  getSnapshotHealth: vi.fn(),
}));
const request = () => new Request("http://localhost/api/cron/snapshot", { headers: { authorization: "Bearer test-secret" } });
beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.mocked(getSnapshotHealth).mockResolvedValue({ ok: true, maxAgeMinutes: 30, boards: [{ season: "2026-09", region: "global", checkedAt: "2026-10-01T12:00:00Z", status: "fresh" }] });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("requires authentication before running a snapshot", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect((await GET(new Request("http://localhost/api/cron/snapshot"))).status).toBe(401);
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(request())).status).toBe(401);
  expect(runSnapshot).not.toHaveBeenCalled();
});

it("returns 503 for a failed source even when an earlier successful check is recent", async () => {
  vi.mocked(runSnapshot).mockResolvedValue([{ season: "2026-09", region: "global", status: "error", detail: "Source returned HTTP 503" }]);
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect((await response.json()).ok).toBe(false);
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("returns 200 for expected new-season emptiness when the previous board refreshed", async () => {
  vi.mocked(runSnapshot).mockResolvedValue([
    { season: "2026-10", region: "global", status: "unavailable", detail: "Empty board" },
    { season: "2026-09", region: "global", status: "unchanged" },
  ]);
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect((await response.json()).ok).toBe(true);
});

it("does nothing, and says so, when another snapshot holds the lease", async () => {
  // Vercel Cron and a GitHub run (by hand, or the freshness monitor's stand-in) can call at once.
  const db = await getDb();
  await db.query(`insert into meta (key, value, updated_at) values ('snapshot_lease', '{"token":"other-run"}'::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`);
  try {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, skipped: expect.any(String) });
    expect(runSnapshot).not.toHaveBeenCalled();
  } finally {
    await db.query(`delete from meta where key = 'snapshot_lease'`);
  }
});

it("releases the lease after a run, so the next scheduled call goes ahead", async () => {
  vi.mocked(runSnapshot).mockResolvedValue([{ season: "2026-09", region: "global", status: "unchanged" }]);
  expect((await GET(request())).status).toBe(200);
  expect((await GET(request())).status).toBe(200);
  expect(runSnapshot).toHaveBeenCalledTimes(2);
});

it("tells Discord once when the board goes stale, without changing what the run answers", async () => {
  const db = await getDb();
  await db.query(`insert into meta (key, value, updated_at) values ('snapshot_alert', '{"stale":false}'::jsonb, now())
    on conflict (key) do update set value = excluded.value`);
  vi.stubEnv("SNAPSHOT_ALERT_DISCORD_URL", "https://discord.com/api/webhooks/1/token");
  const posts: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    posts.push(JSON.parse(String(init.body)).content);
    return new Response(null, { status: 204 });
  }));
  vi.mocked(getSnapshotHealth).mockResolvedValue({ ok: false, maxAgeMinutes: 30, boards: [{ season: "2026-10", region: "global", checkedAt: "2026-10-21T14:40:17Z", status: "stale" }] });
  vi.mocked(runSnapshot).mockResolvedValue([{ season: "2026-10", region: "global", status: "error", detail: "Source returned HTTP 503" }]);
  try {
    const first = await GET(request());
    expect(first.status).toBe(503);
    expect((await first.json()).alert).toBe("sent");
    const second = await GET(request());
    expect((await second.json()).alert).toBe("unchanged");
    expect(posts).toHaveLength(1);
    expect(posts[0]).toContain("Source returned HTTP 503");

    // Discord down: the run still answers on its own terms, and the next one tries again.
    vi.mocked(getSnapshotHealth).mockResolvedValue({ ok: true, maxAgeMinutes: 30, boards: [{ season: "2026-10", region: "global", checkedAt: "2026-10-21T15:20:17Z", status: "fresh" }] });
    vi.mocked(runSnapshot).mockResolvedValue([{ season: "2026-10", region: "global", status: "updated" }]);
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    const third = await GET(request());
    expect(third.status).toBe(200);
    expect(await third.json()).toMatchObject({ ok: true, alert: "failed" });
    expect((await (await GET(request())).json()).alert).toBe("sent");
  } finally {
    vi.unstubAllGlobals();
    await db.query(`delete from meta where key = 'snapshot_alert'`);
  }
});
