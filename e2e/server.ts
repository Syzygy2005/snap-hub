// Test-only infrastructure: an isolated local DB and Discord stub, never a production bypass.
import { PGlite } from "@electric-sql/pglite";
import { mkdtemp, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { SCHEMA } from "../src/lib/db/schema";

async function main() {
  await mkdir(".data", { recursive: true });
  const dir = await mkdtemp(resolve(".data/e2e-"));
  const db = new PGlite(dir);
  await db.exec(SCHEMA);
  for (let i = 1; i <= 12; i++) {
    await db.query("insert into cards (def_id, name, cost, power, ability, art, series, deckable) values ($1, $2, $3, 2, '', '/brand/icon.png', '1', true)", [`TestCard${i}`, `Test Card ${i}`, i % 7]);
  }
  await db.query("insert into locations(def_id,name,ability,art,rarity,status) values ('Asgard','Asgard','After turn 4, whoever is winning here draws 2 cards.','/brand/icon.png','common','released')");
  await db.query("insert into cards(def_id,name,cost,power,ability,art,series,deckable,reference_status) values ('Upcoming','Upcoming Card',1,1,'','','1',false,'unreleased')");
  await db.close();
  const oauth = createServer((req, res) => {
    const url = new URL(req.url!, "http://127.0.0.1:3102");
    if (url.pathname === "/authorize") {
      const callback = new URL(url.searchParams.get("redirect_uri")!);
      callback.searchParams.set("code", "test-code");
      callback.searchParams.set("state", url.searchParams.get("state")!);
      res.writeHead(302, { Location: callback.toString() }); res.end();
    } else {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(url.pathname === "/token" ? { access_token: "test-token", token_type: "Bearer" } : { id: "e2e-account", username: "Browser Tester", avatar: null }));
    }
  });
  await new Promise<void>((ready) => oauth.listen(3102, "127.0.0.1", ready));
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3101", "-H", "127.0.0.1"], {
    stdio: "inherit", windowsHide: true,
    env: { ...process.env, DATABASE_URL: "", PGLITE_DIR: dir, SITE_URL: "http://127.0.0.1:3101", TRACKER_INVITE_CODE: "", DISCORD_CLIENT_ID: "test", DISCORD_CLIENT_SECRET: "test", DISCORD_AUTHORIZE_URL: "http://127.0.0.1:3102/authorize", DISCORD_TOKEN_URL: "http://127.0.0.1:3102/token", DISCORD_USER_URL: "http://127.0.0.1:3102/user" },
  });
  const stop = () => { child.kill(); oauth.close(); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  child.on("exit", (code) => { oauth.close(); process.exit(code ?? 0); });
}
void main();
