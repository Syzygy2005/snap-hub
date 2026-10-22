import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { alertMessage, alertWebhookUrl, notifyHealthChange } from "./alert";
import type { SnapshotHealth } from "./health";
import type { IngestSummary } from "./ingest";

const HOOK = "https://discord.com/api/webhooks/123/secret-token";
const now = new Date("2026-10-21T15:15:00Z");
const fresh: SnapshotHealth = { ok: true, maxAgeMinutes: 30, boards: [{ season: "2026-10", region: "global", checkedAt: "2026-10-21T15:10:17Z", status: "fresh" }] };
const stale: SnapshotHealth = { ok: false, maxAgeMinutes: 30, boards: [{ season: "2026-10", region: "global", checkedAt: "2026-10-21T14:40:17Z", status: "stale" }] };
const held: IngestSummary[] = [{ season: "2026-10", region: "global", status: "held", detail: "60 players would leave at once." }];

const posts: { url: string; body: { content: string; allowed_mentions: unknown } }[] = [];
let answer: () => Promise<Response> = async () => new Response(null, { status: 204 });

beforeEach(async () => {
  posts.length = 0;
  answer = async () => new Response(null, { status: 204 });
  vi.stubEnv("SNAPSHOT_ALERT_DISCORD_URL", HOOK);
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    posts.push({ url, body: JSON.parse(String(init.body)) });
    return answer();
  }));
  await (await getDb()).query(`delete from meta where key = 'snapshot_alert'`);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("alertWebhookUrl", () => {
  it("uses only an https Discord webhook", () => {
    expect(alertWebhookUrl()).toBe(HOOK);
    for (const bad of ["", "http://discord.com/api/webhooks/1/x", "https://example.com/api/webhooks/1/x",
      "https://discord.com/channels/1/2", "https://discord.com.evil.example/api/webhooks/1/x", "not a url"]) {
      vi.stubEnv("SNAPSHOT_ALERT_DISCORD_URL", bad);
      expect(alertWebhookUrl(), bad).toBeNull();
    }
    vi.stubEnv("SNAPSHOT_ALERT_DISCORD_URL", "https://ptb.discord.com/api/webhooks/1/x");
    expect(alertWebhookUrl()).not.toBeNull();
  });
});

describe("notifyHealthChange", () => {
  it("does nothing without a webhook", async () => {
    vi.stubEnv("SNAPSHOT_ALERT_DISCORD_URL", "");
    expect(await notifyHealthChange(stale, held, now)).toBe("off");
    expect(posts).toHaveLength(0);
  });

  it("starts quietly on a healthy board, then tells the channel once when it goes stale", async () => {
    expect(await notifyHealthChange(fresh, [], now)).toBe("unchanged");
    expect(posts).toHaveLength(0);

    expect(await notifyHealthChange(stale, held, now)).toBe("sent");
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe(HOOK);
    expect(posts[0].body.allowed_mentions).toEqual({ parse: [] });
    expect(posts[0].body.content).toBe([
      "Snap Hub: the leaderboard has not refreshed in over 30 minutes.",
      "October 2026 Global: last refreshed 2026-10-21 14:40 UTC, 35 minutes ago.",
      "",
      "This run:",
      "October 2026 Global: held. 60 players would leave at once.",
    ].join("\n"));

    // Still stale on the next runs: nothing more until it changes.
    expect(await notifyHealthChange(stale, held, now)).toBe("unchanged");
    expect(await notifyHealthChange(stale, held, now)).toBe("unchanged");
    expect(posts).toHaveLength(1);

    expect(await notifyHealthChange(fresh, [], now)).toBe("sent");
    expect(posts[1].body.content).toBe("Snap Hub: the leaderboard is refreshing again.\nOctober 2026 Global: refreshed 2026-10-21 15:10 UTC.");
    expect(await notifyHealthChange(fresh, [], now)).toBe("unchanged");
    expect(posts).toHaveLength(2);
  });

  it("tries again on the next run when Discord refuses or does not answer", async () => {
    await notifyHealthChange(fresh, [], now);
    answer = async () => new Response("rate limited", { status: 429 });
    expect(await notifyHealthChange(stale, held, now)).toBe("failed");
    answer = async () => { throw new DOMException("The operation timed out.", "TimeoutError"); };
    expect(await notifyHealthChange(stale, held, now)).toBe("failed");
    answer = async () => new Response(null, { status: 204 });
    expect(await notifyHealthChange(stale, held, now)).toBe("sent");
    expect(await notifyHealthChange(stale, held, now)).toBe("unchanged");
    expect(posts).toHaveLength(3);
  });

  it("retries a first alert that never got through, with no state saved before it", async () => {
    answer = async () => new Response(null, { status: 500 });
    expect(await notifyHealthChange(stale, held, now)).toBe("failed");
    answer = async () => new Response(null, { status: 204 });
    expect(await notifyHealthChange(stale, held, now)).toBe("sent");
  });

  it("posts once when two runs see the same change at the same moment", async () => {
    await notifyHealthChange(fresh, [], now);
    const results = await Promise.all([notifyHealthChange(stale, held, now), notifyHealthChange(stale, held, now)]);
    expect(results.sort()).toEqual(["sent", "unchanged"]);
    expect(posts).toHaveLength(1);
  });

  it("keeps a long run report inside Discord's 2000-character limit", async () => {
    await notifyHealthChange(fresh, [], now);
    const long: IngestSummary[] = [{ season: "2026-10", region: "global", status: "error", detail: "x".repeat(5000) }];
    expect(await notifyHealthChange(stale, long, now)).toBe("sent");
    expect(posts[0].body.content.length).toBe(2000);
  });
});

describe("alertMessage", () => {
  it("says a board that was never refreshed never was", () => {
    const missing: SnapshotHealth = { ok: false, maxAgeMinutes: 30, boards: [{ season: "2026-11", region: "global", checkedAt: null, status: "missing" }] };
    expect(alertMessage(missing, [], now)).toContain("November 2026 Global: never refreshed.");
  });
});
