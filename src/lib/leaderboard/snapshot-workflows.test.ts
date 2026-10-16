import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Vercel Cron takes the scheduled snapshots. The GitHub snapshot workflow used to run on the same
 * 10-minute schedule as a backup, and every run it made was a full fetch of the official board:
 * 45 in about 46 hours on 15 and 16 October 2026, while the freshness monitor found the board fresh
 * on all 41 of its checks. Marvel Snap's terms rule out automated collection from their sites, so
 * the site asks for nothing it does not need: the monitor takes one snapshot only when it finds a
 * board stale, and fails anyway so the alert still goes out.
 *
 * The monitor's step is run here as GitHub runs it, with bash, curl and jq, against a stub site.
 */

const workflow = (name: string) => readFile(path.join(".github", "workflows", name), "utf8");

/** The `run: |` block of a workflow's one scripted step, dedented, as GitHub hands it to bash. */
function stepScript(yaml: string) {
  const lines = yaml.split("\n");
  const starts = lines.flatMap((line, i) => (/^\s+run: \|\s*$/.test(line) ? [i] : []));
  expect(starts).toHaveLength(1);
  const indent = lines[starts[0]].search(/\S/);
  const body: string[] = [];
  for (const line of lines.slice(starts[0] + 1)) {
    if (line.trim() && line.search(/\S/) <= indent) break;
    body.push(line);
  }
  const pad = Math.min(...body.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  return body.map((l) => l.slice(pad)).join("\n");
}

const haveTools = (() => {
  try {
    execFileSync("bash", ["-c", "command -v curl && command -v jq"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("snapshot scheduling", () => {
  it("leaves the schedule to Vercel Cron, and the GitHub snapshot workflow to a person", async () => {
    const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
    expect(vercel.crons).toContainEqual({ path: "/api/cron/snapshot", schedule: "*/10 * * * *" });
    const snapshot = await workflow("snapshot.yml");
    expect(snapshot).toMatch(/^\s+workflow_dispatch:/m);
    expect(snapshot).not.toMatch(/^\s+schedule:/m);
  });
});

describe.skipIf(!haveTools)("the freshness monitor", () => {
  let server: Server;
  let site: string;
  let script: string;
  let health: { status: number; body: unknown };
  const calls: string[] = [];

  beforeAll(async () => {
    script = stepScript(await workflow("snapshot-health.yml"));
    server = createServer((req, res) => {
      calls.push(req.url ?? "");
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (req.headers.authorization !== "Bearer monitor-secret") return send(401, { ok: false, error: "Unauthorized" });
      if (req.url === "/api/cron/snapshot/health") return send(health.status, health.body);
      if (req.url === "/api/cron/snapshot") return send(200, { ok: true, leaderboard: [{ status: "updated" }] });
      send(404, {});
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    site = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  /** Runs the step the way GitHub does (`bash -e`), so a failing command fails it here too. */
  async function monitor(status: number, body: unknown, secret = "monitor-secret") {
    health = { status, body };
    calls.length = 0;
    const cwd = await mkdtemp(path.join(tmpdir(), "snaphub-monitor-"));
    try {
      await writeFile(path.join(cwd, "step.sh"), script);
      // Asynchronous on purpose: a synchronous child would block the stub server it is calling.
      const code = await new Promise<number>((resolve) => {
        execFile("bash", ["-e", "step.sh"], {
          cwd,
          // The stub is local, so no proxy a developer's shell carries may route it.
          env: { ...process.env, SITE_URL: site, CRON_SECRET: secret, NO_PROXY: "127.0.0.1", no_proxy: "127.0.0.1" },
        }, (error) => resolve(error ? Number(error.code ?? 1) : 0));
      });
      return { code, calls: [...calls] };
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }

  it("asks nothing more of the site while the board is fresh", async () => {
    const run = await monitor(200, { ok: true, maxAgeMinutes: 30, boards: [{ season: "2026-10", region: "global", status: "fresh" }] });
    expect(run).toEqual({ code: 0, calls: ["/api/cron/snapshot/health"] });
  });

  it("takes one snapshot when a board is stale, and still fails so somebody hears about it", async () => {
    const run = await monitor(503, { ok: false, maxAgeMinutes: 30, boards: [{ season: "2026-10", region: "global", status: "stale" }] });
    expect(run).toEqual({ code: 1, calls: ["/api/cron/snapshot/health", "/api/cron/snapshot"] });
  });

  it("does the same for a board that has never been checked", async () => {
    const run = await monitor(503, { ok: false, maxAgeMinutes: 30, boards: [{ season: "2026-10", region: "global", status: "missing" }] });
    expect(run).toEqual({ code: 1, calls: ["/api/cron/snapshot/health", "/api/cron/snapshot"] });
  });

  it("does not snapshot when the check itself failed or was refused", async () => {
    // A failed check answers 503 too, but names no board; a snapshot would fail the same way.
    expect(await monitor(503, { ok: false, error: "Could not check leaderboard freshness; inspect the server log." }))
      .toEqual({ code: 1, calls: ["/api/cron/snapshot/health"] });
    expect(await monitor(200, {}, "wrong-secret")).toEqual({ code: 1, calls: ["/api/cron/snapshot/health"] });
  });
});
