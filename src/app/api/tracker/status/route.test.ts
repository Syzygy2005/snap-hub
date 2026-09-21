import { expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { createTracker } from "@/lib/stats/tracker";
import { GET } from "./route";

it("rejects unknown keys and reports only the held key's upload time", async () => {
  vi.stubEnv("TRACKER_INVITE_CODE", "");
  try {
    expect((await GET(new Request("http://localhost/api/tracker/status"))).status).toBe(401);
    const key = await createTracker({ name: "Status test" });
    if (!key.ok) throw new Error(key.error);
    const request = () => new Request("http://localhost/api/tracker/status", { headers: { authorization: `Bearer ${key.token}` } });
    expect(await (await GET(request())).json()).toEqual({ ok: true, lastUploadAt: null });
    const db = await getDb();
    await db.query("update trackers set last_upload_at = $1 where id = $2", [new Date("2026-09-21T12:00:00Z"), key.tracker.id]);
    const res = await GET(request());
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toEqual({ ok: true, lastUploadAt: "2026-09-21T12:00:00.000Z" });
  } finally { vi.unstubAllEnvs(); }
});
