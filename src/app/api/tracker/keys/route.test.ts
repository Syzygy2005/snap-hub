import { beforeEach, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { currentAccount } from "@/lib/auth/session";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn() }));
const account = { id: 9201, discordId: "key-maker", username: "Maker", avatar: null };
const make = () => POST(new Request("http://localhost/api/tracker/keys", { method: "POST", body: JSON.stringify({ name: "Gaming PC" }) }));

beforeEach(async () => {
  const db = await getDb();
  await db.query("insert into accounts (id, discord_id, username) values (9201, 'key-maker', 'Maker') on conflict do nothing");
  await db.query("delete from tracked_games");
  await db.query("delete from snap_names");
  await db.query("delete from trackers");
});

it("makes no key without an account, since a key can put any file into the community stats", async () => {
  vi.mocked(currentAccount).mockResolvedValue(null);
  const res = await make();
  expect(res.status).toBe(401);
  expect((await res.json()).error).toContain("Sign in with Discord");
  const db = await getDb();
  expect(await db.query("select id from trackers")).toEqual([]);
});

it("makes a key on the signed-in account", async () => {
  vi.mocked(currentAccount).mockResolvedValue(account);
  const res = await make();
  expect(res.status).toBe(200);
  expect((await res.json()).token).toBeTruthy();
  const db = await getDb();
  expect(await db.query("select account_id from trackers")).toEqual([{ account_id: 9201 }]);
});
