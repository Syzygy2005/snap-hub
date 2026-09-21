import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, type Db } from "@/lib/db";
import type { Account } from "@/lib/auth/session";

/** The account is taken from the session, never the request, so nobody claims for somebody else. */
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  currentAccount: vi.fn(),
}));

const { currentAccount } = await import("@/lib/auth/session");
const { POST, DELETE, PATCH } = await import("./route");
const { claimForPlayer, claimPlayer } = await import("@/lib/leaderboard/claims");

const who = vi.mocked(currentAccount);
const acct = (id: number, discordId: string): Account => ({ id, discordId, username: `U${id}`, avatar: null });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const req = () => new Request("https://snap-hub.app/x", { method: "POST" });

let db: Db;
let noah: number;
let other: number;
beforeEach(async () => {
  db = await getDb();
  await db.query(`delete from player_claims`);
  await db.query(`delete from snap_names`);
  await db.query(`delete from players`);
  await db.query(`delete from accounts`);
  const rows = await db.query<{ id: number }>(
    `insert into accounts (discord_id, username) values ('111','Noah'), ('222','Someone') returning id`,
  );
  [noah, other] = rows.map((r) => r.id);
  await db.query(`insert into players (id, name) values (11, 'PXL Rick')`);
  vi.stubEnv("ADMIN_DISCORD_IDS", "111");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("claiming through the route", () => {
  it("turns away a signed-out visitor", async () => {
    who.mockResolvedValue(null);
    expect((await POST(req(), ctx("11"))).status).toBe(401);
    expect(await claimForPlayer(11)).toBeNull();
  });

  it("claims for the session's account, whatever the URL says", async () => {
    who.mockResolvedValue(acct(other, "222"));
    expect((await POST(req(), ctx("11"))).status).toBe(200);
    expect((await claimForPlayer(11))?.accountId).toBe(other);
  });

  it("answers 409 when somebody else has it", async () => {
    await claimPlayer(11, noah);
    who.mockResolvedValue(acct(other, "222"));
    expect((await POST(req(), ctx("11"))).status).toBe(409);
  });

  it("answers 404 for an id that is not a number", async () => {
    who.mockResolvedValue(acct(other, "222"));
    for (const id of ["abc", "0", "-3"]) expect((await POST(req(), ctx(id))).status).toBe(404);
  });
});

describe("releasing and confirming through the route", () => {
  it("will not let one person release another's claim", async () => {
    await claimPlayer(11, other);
    who.mockResolvedValue(acct(other + 999, "333"));
    expect((await DELETE(req(), ctx("11"))).status).toBe(404);
    expect(await claimForPlayer(11)).not.toBeNull();
  });

  it("lets an admin release anybody's", async () => {
    await claimPlayer(11, other);
    who.mockResolvedValue(acct(noah, "111"));
    expect((await DELETE(req(), ctx("11"))).status).toBe(200);
    expect(await claimForPlayer(11)).toBeNull();
  });

  it("confirms only for an admin", async () => {
    await claimPlayer(11, other);
    who.mockResolvedValue(acct(other, "222"));
    expect((await PATCH(req(), ctx("11"))).status).toBe(403);
    expect((await claimForPlayer(11))?.verifiedAt).toBeNull();

    who.mockResolvedValue(acct(noah, "111"));
    expect((await PATCH(req(), ctx("11"))).status).toBe(200);
    expect((await claimForPlayer(11))?.verifiedBy).toBe("admin");
    // Confirming twice is not a thing.
    expect((await PATCH(req(), ctx("11"))).status).toBe(404);
  });

  it("requires an admin to confirm a legacy tracker-verified claim", async () => {
    await claimPlayer(11, other);
    await db.query(`update player_claims set verified_at = now(), verified_by = 'tracker' where player_id = 11`);
    who.mockResolvedValue(acct(other, "222"));
    expect((await PATCH(req(), ctx("11"))).status).toBe(403);
    expect((await claimForPlayer(11))?.verifiedAt).toBeNull();

    who.mockResolvedValue(acct(noah, "111"));
    expect((await PATCH(req(), ctx("11"))).status).toBe(200);
    expect((await claimForPlayer(11))?.verifiedBy).toBe("admin");
  });

  it("will not confirm claims for a signed-out visitor", async () => {
    await claimPlayer(11, other);
    who.mockResolvedValue(null);
    expect((await PATCH(req(), ctx("11"))).status).toBe(403);
    expect((await claimForPlayer(11))?.verifiedAt).toBeNull();
  });
});
