import { beforeEach, describe, expect, it } from "vitest";
import { getDb, type Db } from "@/lib/db";
import { claimForAccount, claimForPlayer, claimPlayer, releaseClaim, verifyClaim } from "./claims";

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

  it("clears itself when a tracker on that account has played under the name", async () => {
    await sighting(noah, "PXL Rick");
    const result = await claimPlayer(11, noah);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claim.verifiedBy).toBe("tracker");
    expect(result.claim.verifiedAt).not.toBeNull();
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
