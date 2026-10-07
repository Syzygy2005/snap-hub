import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getSnapshotHealth } from "@/lib/leaderboard/health";
import { GET } from "./route";

vi.mock("@/lib/leaderboard/health", () => ({ getSnapshotHealth: vi.fn() }));
const request = () => new Request("http://localhost/api/cron/snapshot/health", { headers: { authorization: "Bearer test-secret" } });
beforeEach(() => vi.stubEnv("CRON_SECRET", "test-secret"));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it("requires authentication before reading health", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect((await GET(new Request("http://localhost/api/cron/snapshot/health"))).status).toBe(401);
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(request())).status).toBe(401);
  expect(getSnapshotHealth).not.toHaveBeenCalled();
});

it("returns uncached 503 for stale checks and 200 after recovery", async () => {
  vi.mocked(getSnapshotHealth).mockResolvedValueOnce({ ok: false, maxAgeMinutes: 30, boards: [{ season: "2026-10", region: "global", checkedAt: "2026-10-07T10:00:00Z", status: "stale" }] });
  const stale = await GET(request());
  expect(stale.status).toBe(503);
  expect(stale.headers.get("cache-control")).toBe("no-store");
  expect((await stale.json()).ok).toBe(false);
  vi.mocked(getSnapshotHealth).mockResolvedValueOnce({ ok: true, maxAgeMinutes: 30, boards: [{ season: "2026-10", region: "global", checkedAt: "2026-10-07T12:00:00Z", status: "fresh" }] });
  expect((await GET(request())).status).toBe(200);
});

it("reports database failures without exposing connection details", async () => {
  vi.mocked(getSnapshotHealth).mockRejectedValueOnce(new Error("private database details"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private database details");
});
