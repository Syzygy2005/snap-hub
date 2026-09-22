import { beforeEach, describe, expect, it } from "vitest";
import { getDb, type Db } from "@/lib/db";
import { claimForAccount, claimForPlayer, claimForViewer, claimPlayer, releaseClaim, verifyClaim } from "./claims";

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
    `insert into accounts (discord_id, username) values ('1','Noah'), ('2','Someone') returning id`,
  );
  [noah, other] = rows.map((r) => r.id);
  await db.query(`insert into players (id, name) values (11, 'PXL Rick'), (12, 'Other Player')`);
});

const sighting = (accountId: number, name: string) =>
  db.query(
    `insert into snap_names (account_hash, name, games, account_id) values ($1, $2, 1, $3)`,
    [`h-${accountId}`, name, accountId],
  );

describe("claiming a leaderboard profile", () => {
  it("stays unverified when nothing vouches for it", async () => {
    const result = await claimPlayer(11, noah);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claim).toMatchObject({ playerName: "PXL Rick", username: "Noah", verifiedAt: null, verifiedBy: null });
  });

  it("gives the loser of a simultaneous claim a refusal, not a crash", async () => {
    // Both callers read before either writes, so the check above the insert cannot decide this.
    // The loser used to hit the player_id primary key and throw out through the route as a 500.
    const [first, second] = await Promise.all([claimPlayer(11, noah), claimPlayer(11, other)]);
    const results = [first, second];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const refused = results.find((r) => !r.ok);
    expect(refused).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses a second player for one account without crashing", async () => {
    // player_claims_account_idx is the other way two writes collide.
    const [a, b] = await Promise.all([claimPlayer(11, noah), claimPlayer(12, noah)]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect([a, b].find((r) => !r.ok)).toMatchObject({ ok: false, status: 409 });
  });

  it("stays pending even when the claimant's tracker reports the same name", async () => {
    await sighting(noah, "PXL Rick");
    const result = await claimPlayer(11, noah);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claim).toMatchObject({ verifiedBy: null, verifiedAt: null });
    const [stored] = await db.query(`select verified_at, verified_by from player_claims where player_id = 11`);
    expect(stored).toMatchObject({ verified_at: null, verified_by: null });
  });

  it("does not promote a pending claim after a matching upload or another claim request", async () => {
    await claimPlayer(11, noah);
    await sighting(noah, "PXL Rick");
    expect(await claimPlayer(11, noah)).toMatchObject({ ok: true, claim: { verifiedBy: null, verifiedAt: null } });
  });

  it("does not clear itself on somebody else's tracker sighting", async () => {
    await sighting(other, "PXL Rick");
    const result = await claimPlayer(11, noah);
    expect(result.ok && result.claim.verifiedAt).toBeNull();
  });

  it("refuses a player somebody else already claimed", async () => {
    await claimPlayer(11, noah);
    expect(await claimPlayer(11, other)).toMatchObject({ ok: false, status: 409 });
    expect((await claimForPlayer(11))?.username).toBe("Noah");
  });

  it("is idempotent for the person who already claimed it", async () => {
    await claimPlayer(11, noah);
    expect((await claimPlayer(11, noah)).ok).toBe(true);
  });

  it("holds an account to one profile, since two rows means a merge is owed", async () => {
    await claimPlayer(11, noah);
    const second = await claimPlayer(12, noah);
    expect(second).toMatchObject({ ok: false, status: 409 });
    if (!second.ok) expect(second.error).toContain("PXL Rick");
  });

  it("refuses a player that does not exist", async () => {
    expect(await claimPlayer(999, noah)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("releasing and confirming", () => {
  it.each(["tracker", "unknown", null])("requires admin confirmation for legacy verification by %s", async (method) => {
    await claimPlayer(11, noah);
    await db.query(`update player_claims set verified_at = now(), verified_by = $1 where player_id = 11`, [method]);
    expect(await claimForPlayer(11)).toMatchObject({ verifiedAt: null, verifiedBy: null });
    expect(await claimForAccount(noah)).toMatchObject({ verifiedAt: null, verifiedBy: null });
    expect(await claimForViewer(11, null, false)).toEqual({ claim: null, mine: false });
    expect(await claimForViewer(11, other, true)).toEqual({
      claim: { username: "Noah", verifiedAt: null }, mine: false,
    });

    const confirmed = await verifyClaim(11);
    expect(confirmed?.verifiedBy).toBe("admin");
    expect(confirmed?.verifiedAt).not.toBeNull();
    expect(await verifyClaim(11)).toBeNull();
  });

  it("lets the owner release theirs and nobody else's", async () => {
    await claimPlayer(11, noah);
    expect(await releaseClaim(11, other)).toBe(false);
    expect(await claimForPlayer(11)).not.toBeNull();
    expect(await releaseClaim(11, noah)).toBe(true);
    expect(await claimForPlayer(11)).toBeNull();
  });

  it("lets an admin release anyone's, which is what null means here", async () => {
    await claimPlayer(11, noah);
    expect(await releaseClaim(11, null)).toBe(true);
    expect(await claimForPlayer(11)).toBeNull();
  });

  it("confirms an unverified claim once and not twice", async () => {
    await claimPlayer(11, noah);
    const confirmed = await verifyClaim(11);
    expect(confirmed).toMatchObject({ verifiedBy: "admin" });
    expect(await verifyClaim(11)).toBeNull();
    expect(await verifyClaim(12)).toBeNull();
  });

  it("finds a person's claim from their account", async () => {
    expect(await claimForAccount(noah)).toBeNull();
    await claimPlayer(11, noah);
    expect((await claimForAccount(noah))?.playerName).toBe("PXL Rick");
  });

  it("goes when the player row goes", async () => {
    await claimPlayer(11, noah);
    await db.query(`delete from players where id = 11`);
    expect(await claimForAccount(noah)).toBeNull();
  });
});

describe("claim data sent to the browser", () => {
  it("does not send a pending claim to anonymous visitors or another signed-in account", async () => {
    await claimPlayer(11, noah);
    for (const viewer of [null, other]) {
      expect(await claimForViewer(11, viewer, false)).toEqual({ claim: null, mine: false });
    }
  });

  it("sends only the display fields to the claimant and an admin", async () => {
    await claimPlayer(11, noah);
    expect(await claimForViewer(11, noah, false)).toEqual({
      claim: { username: "Noah", verifiedAt: null }, mine: true,
    });
    expect(await claimForViewer(11, other, true)).toEqual({
      claim: { username: "Noah", verifiedAt: null }, mine: false,
    });
  });

  it("makes only admin-confirmed display fields public", async () => {
    await claimPlayer(11, noah);
    const now = new Date("2026-09-21T12:00:00Z");
    await verifyClaim(11, now);
    expect(await claimForViewer(11, null, false)).toEqual({
      claim: { username: "Noah", verifiedAt: now.toISOString() }, mine: false,
    });
  });

  it("returns no claim when the profile is unclaimed", async () => {
    expect(await claimForViewer(11, noah, false)).toEqual({ claim: null, mine: false });
  });
});
