import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("public/tracker/snaphub-tracker.ps1");
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 15_000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Tracker did not reach the expected state within 15 seconds");
    await pause(100);
  }
}
type Upload = { id: string; headers: IncomingMessage["headers"]; raw: string };
type QueueRecord = { gameId: string; site: string; key: string; accountId: string; created: string; nextAttempt: string; held: boolean; attempts: number };
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.reverse()) await close();
  cleanup.length = 0;
});

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "snaphub-queue-"));
  const state = path.join(dir, "nvprod");
  const config = path.join(dir, "config");
  await mkdir(state);
  await mkdir(config);
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const game = async (id: string) => writeFile(path.join(state, "GameState.json"), JSON.stringify({ ClientResultMessage: { GameId: id } }));
  const account = async (id: string) => writeFile(path.join(state, "AccountState.json"), JSON.stringify({ ServerState: { Account: { Id: id } } }));
  await account("snap-original");
  async function queue() {
    const queueDir = path.join(config, "queue");
    const files = await readdir(queueDir, { recursive: true }).catch(() => [] as string[]);
    return Promise.all(files.filter((name) => name.endsWith(".json")).map(async (name) => ({
      file: path.join(queueDir, name),
      data: JSON.parse(await readFile(path.join(queueDir, name), "utf8")) as QueueRecord,
    })));
  }
  async function due() {
    for (const entry of await queue()) {
      entry.data.nextAttempt = "2000-01-01T00:00:00.000Z";
      await writeFile(entry.file, JSON.stringify(entry.data));
    }
  }
  return { state, config, game, account, queue, due };
}

function ack(response: ServerResponse, id: string, duplicate = false) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, duplicate, game: { gameId: id, result: "win", cubes: 2, deckName: "Test deck" } }));
}
async function server(reply: (upload: Upload, response: ServerResponse) => void) {
  const requests: Upload[] = [];
  const app = createServer(async (request, response) => {
    const parts: Buffer[] = [];
    for await (const part of request) parts.push(Buffer.from(part));
    const raw = gunzipSync(Buffer.concat(parts)).toString("utf8");
    const text = raw.replace(/^\uFEFF/, "");
    const id = /"ClientResultMessage"[\s\S]*?"GameId"\s*:\s*"([^"]+)"/.exec(text)![1];
    const upload = { id, headers: request.headers, raw };
    requests.push(upload);
    reply(upload, response);
  });
  await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
  cleanup.push(async () => {
    app.closeAllConnections();
    await new Promise<void>((resolve) => app.close(() => resolve()));
  });
  const address = app.address() as { port: number };
  return { url: `http://127.0.0.1:${address.port}`, requests };
}
function tracker(f: Awaited<ReturnType<typeof fixture>>, site: string, key = "shk_original", extra: string[] = []) {
  const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script,
    "-StateDir", f.state, "-ConfigDir", f.config, "-Site", site, "-Key", key, "-IntervalSeconds", "1", ...extra];
  const child: ChildProcess = spawn("powershell.exe", args, { windowsHide: true });
  let output = "";
  child.stdout!.on("data", (data) => { output += data.toString(); });
  child.stderr!.on("data", (data) => { output += data.toString(); });
  const done = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  const stop = async () => { if (child.exitCode === null) child.kill(); await done; };
  cleanup.push(stop);
  return { done, stop, output: () => output };
}

// The Windows job exercises the distributed script in its supported runtime, not pwsh.
describe.skipIf(process.platform !== "win32")("Windows PowerShell 5.1 durable tracker queue", () => {
  it("uploads a real BOM-bearing game with -Once and never recaptures it after acknowledgement", async () => {
    const f = await fixture();
    const raw = await readFile(path.resolve("src/lib/stats/fixtures/real-game.json"));
    await writeFile(path.join(f.state, "GameState.json"), raw);
    const s = await server((upload, response) => ack(response, upload.id, true));
    const first = tracker(f, s.url, undefined, ["-Once"]);
    expect(await first.done, first.output()).toBe(0);
    expect(s.requests).toHaveLength(1);
    expect(Buffer.from(s.requests[0].raw)).toEqual(raw);
    expect(s.requests[0].headers["x-snap-account-id"]).toBe("snap-original");
    expect(s.requests[0].headers["x-snaphub-captured-at"]).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(await f.queue()).toHaveLength(0);
    expect(first.output()).toContain("Already recorded game");
    // A settings/account change must not upload the unchanged current game to another account.
    await f.account("snap-other");
    const second = tracker(f, s.url, "shk_other", ["-Once", "-Reset"]);
    expect(await second.done, second.output()).toBe(0);
    expect(s.requests).toHaveLength(1);
  });

  it("captures through an outage and next-game overwrite, then restores each original destination on restart", async () => {
    const f = await fixture();
    let offline = true;
    const original = await server((upload, response) => {
      if (offline) { response.writeHead(503); response.end("Unavailable"); }
      else ack(response, upload.id);
    });
    await f.game("outage-first");
    const running = tracker(f, original.url);
    await until(() => running.output().includes("retrying in 10 seconds"));
    await f.game("outage-second");
    await until(async () => (await f.queue()).length === 2);
    expect(original.requests.filter((upload) => upload.id === "outage-first")).toHaveLength(1); // backoff does not stop capture
    const saved = await f.queue();
    expect(saved.map((entry) => entry.data.gameId).sort()).toEqual(["outage-first", "outage-second"]);
    expect(saved.find((entry) => entry.data.gameId === "outage-first")!.data.attempts).toBe(1);
    await running.stop();
    await f.due(); // move the persisted retry clock forward without slowing the suite
    offline = false;
    const nextSite = await server((upload, response) => ack(response, upload.id));
    await f.account("snap-other");
    await f.game("new-account-game");
    const resumed = tracker(f, nextSite.url, "shk_other", ["-Once"]);
    expect(await resumed.done, resumed.output()).toBe(0);
    expect(await f.queue()).toHaveLength(0);
    expect(original.requests.slice(-2).map((upload) => upload.id).sort()).toEqual(["outage-first", "outage-second"]);
    for (const upload of original.requests.slice(-2)) {
      expect(upload.headers.authorization).toBe("Bearer shk_original");
      expect(upload.headers["x-snap-account-id"]).toBe("snap-original");
      expect(upload.headers["x-snaphub-captured-at"]).toBe(saved.find((entry) => entry.data.gameId === upload.id)!.data.created);
    }
    expect(nextSite.requests.map((upload) => upload.id)).toEqual(["new-account-game"]);
    expect(nextSite.requests[0].headers.authorization).toBe("Bearer shk_other");
    expect(nextSite.requests[0].headers["x-snap-account-id"]).toBe("snap-other");
    expect(resumed.output()).not.toContain("shk_");
  });

  it("keeps capturing during a slow request and recovers a lost acknowledgement through server dedupe", async () => {
    const f = await fixture();
    const received = new Set<string>();
    let stall = true;
    const s = await server((upload, response) => {
      const duplicate = received.has(upload.id);
      received.add(upload.id);
      if (!stall) ack(response, upload.id, duplicate);
    });
    await f.game("slow-first");
    const running = tracker(f, s.url);
    await until(() => s.requests.length === 1);
    await f.game("slow-second");
    await until(async () => (await f.queue()).length === 2);
    expect(s.requests).toHaveLength(1);
    await running.stop();
    stall = false;
    const resumed = tracker(f, s.url, undefined, ["-Once"]);
    expect(await resumed.done, resumed.output()).toBe(0);
    expect(resumed.output()).toContain("Already recorded game slow-first");
    expect(await f.queue()).toHaveLength(0);
    expect([...received].sort()).toEqual(["slow-first", "slow-second"]);
  });

  it("does not let an older repeatedly failing destination starve uploads to a working site", async () => {
    const f = await fixture();
    const oldSite = await server((_, response) => { response.writeHead(500); response.end("Unavailable"); });
    const newSite = await server((upload, response) => ack(response, upload.id));
    await f.game("old-site-game");
    const first = tracker(f, oldSite.url, undefined, ["-Once"]);
    expect(await first.done, first.output()).toBe(1);
    await f.due();
    await f.game("working-site-game");
    const second = tracker(f, newSite.url, "shk_other", ["-Once"]);
    expect(await second.done, second.output()).toBe(1);
    expect(oldSite.requests).toHaveLength(2);
    expect(newSite.requests.map((upload) => upload.id)).toEqual(["working-site-game"]);
    const remaining = await f.queue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].data).toMatchObject({ gameId: "old-site-game", attempts: 2, site: oldSite.url, key: "shk_original" });
    expect(Date.parse(remaining[0].data.nextAttempt)).toBeGreaterThan(Date.now() + 15_000);
  });

  it.each([401, 422])("holds HTTP %s without blocking new games; explicit retry retains the original key", async (status) => {
    const f = await fixture();
    let reject = true;
    const s = await server((upload, response) => {
      if (reject && upload.id === "held-game") { response.writeHead(status); response.end("Rejected"); }
      else ack(response, upload.id);
    });
    await f.game("held-game");
    const first = tracker(f, s.url, undefined, ["-Once"]);
    expect(await first.done, first.output()).toBe(1);
    expect((await f.queue())[0].data.held).toBe(true);
    await f.game("following-game");
    const second = tracker(f, s.url, "shk_other", ["-Once"]);
    expect(await second.done, second.output()).toBe(1);
    expect(s.requests.map((upload) => upload.id)).toEqual(["held-game", "following-game"]);
    expect(await f.queue()).toHaveLength(1);
    reject = false;
    const retry = tracker(f, s.url, "shk_other", ["-Once", "-RetryHeld"]);
    expect(await retry.done, retry.output()).toBe(0);
    expect(s.requests.at(-1)!.headers.authorization).toBe("Bearer shk_original");
    expect(await f.queue()).toHaveLength(0);
  });

  it("does not acknowledge a generic HTTP 200 page and persists its retry schedule", async () => {
    const f = await fixture();
    const s = await server((_, response) => { response.writeHead(200); response.end("<html>Login</html>"); });
    await f.game("unacknowledged");
    const first = tracker(f, s.url, undefined, ["-Once"]);
    expect(await first.done, first.output()).toBe(1);
    const [entry] = await f.queue();
    expect(entry.data.held).toBe(false);
    expect(entry.data.attempts).toBe(1);
    expect(Date.parse(entry.data.nextAttempt)).toBeGreaterThan(Date.now());
    const second = tracker(f, s.url, undefined, ["-Once"]);
    expect(await second.done).toBe(1);
    expect(s.requests).toHaveLength(1);
  });

  it("retries partial game writes locally and preserves corrupt queued records alongside good uploads", async () => {
    const f = await fixture();
    const s = await server((upload, response) => ack(response, upload.id));
    await writeFile(path.join(f.state, "GameState.json"), '{"ClientResultMessage":{"GameId":"partial"');
    const running = tracker(f, s.url);
    await until(() => running.output().includes("Could not save the current game"));
    expect(await f.queue()).toHaveLength(0);
    expect(s.requests).toHaveLength(0);
    await f.game("partial");
    await until(() => running.output().includes("WIN +2 cubes"));
    await running.stop();
    const corrupt = path.join(f.config, "queue", "corrupt.json");
    await writeFile(corrupt, "not json");
    await f.game("good-game");
    const resumed = tracker(f, s.url, undefined, ["-Once"]);
    expect(await resumed.done, resumed.output()).toBe(1);
    expect(resumed.output()).toContain("Cannot read queued file");
    expect(await readFile(corrupt, "utf8")).toBe("not json");
    expect(s.requests.map((upload) => upload.id)).toEqual(["partial", "good-game"]);
  });
});

it("keeps the distributed script plain ASCII for Windows PowerShell 5.1", async () => {
  const bytes = await readFile(script);
  expect([...bytes].every((byte) => byte < 128)).toBe(true);
});
