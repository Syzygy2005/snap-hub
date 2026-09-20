import { beforeEach, describe, expect, it } from "vitest";
import { getDb, type Db } from "@/lib/db";
import { myTrackedNames, otherNamesUsedWith } from "./identity";

let db: Db;
beforeEach(async () => {
  db = await getDb();
  await db.query(`delete from snap_names`);
  await db.query(`delete from accounts`);
});

const sighting = async (hash: string, name: string, day: number, accountId: number | null = null) => {
  const at = new Date(Date.UTC(2026, 8, day));
  await db.query(
    `insert into snap_names (account_hash, name, first_seen, last_seen, games, account_id)
     values ($1, $2, $3, $3, 1, $4)
     on conflict (account_hash, name) do update set last_seen = excluded.last_seen`,
    [hash, name, at, accountId],
  );
};

describe("names a tracker has seen an account use", () => {
  it("finds the other names one account answered to", async () => {
    await sighting("acct-a", "PXL D. Rick", 1);
    await sighting("acct-a", "PXL Rick", 5);
    await sighting("acct-b", "Somebody Else", 3);

    expect((await otherNamesUsedWith("PXL Rick")).map((n) => n.name)).toEqual(["PXL D. Rick"]);
    expect((await otherNamesUsedWith("PXL D. Rick")).map((n) => n.name)).toEqual(["PXL Rick"]);
    expect(await otherNamesUsedWith("Somebody Else")).toEqual([]);
  });

  it("returns the newest sighting first, with dates and game counts", async () => {
    await sighting("acct-a", "Now", 9);
    await sighting("acct-a", "Middle", 5);
    await sighting("acct-a", "Oldest", 1);
    const rows = await otherNamesUsedWith("Now");
    expect(rows.map((n) => n.name)).toEqual(["Middle", "Oldest"]);
    expect(rows[0].lastSeen).toBe("2026-09-05T00:00:00.000Z");
    expect(rows[0].games).toBe(1);
  });

  it("pulls in every account behind a shared name, which is the case that needs a human", async () => {
    // Two different people have both used "Ghost". Neither the board nor this can say which
    // of them a departure was, so both sets of names come back rather than one being picked.
    await sighting("acct-a", "Ghost", 1);
    await sighting("acct-a", "Ghost Rider", 4);
    await sighting("acct-b", "Ghost", 2);
    await sighting("acct-b", "Ghostface", 6);
    expect((await otherNamesUsedWith("Ghost")).map((n) => n.name)).toEqual(["Ghostface", "Ghost Rider"]);
  });

  it("says whether a signed-in key reported it", async () => {
    const [a] = await db.query<{ id: number }>(
      `insert into accounts (discord_id, username) values ('1', 'Noah') returning id`,
    );
    await sighting("acct-a", "Anon", 1, null);
    await sighting("acct-a", "Claimed", 2, a.id);
    const rows = await otherNamesUsedWith("Anon");
    expect(rows.map((n) => [n.name, n.signedIn])).toEqual([["Claimed", true]]);
    expect((await myTrackedNames(a.id)).map((n) => n.name)).toEqual(["Claimed"]);
    expect(await myTrackedNames(a.id + 999)).toEqual([]);
  });

  it("is quiet about a name nothing has seen", async () => {
    expect(await otherNamesUsedWith("Nobody")).toEqual([]);
    expect(await otherNamesUsedWith("")).toEqual([]);
  });
});

describe("recording a real upload", () => {
  it("remembers the uploader's own name from the game file", async () => {
    const { readFileSync } = await import("node:fs");
    const { recordGame } = await import("./tracker");
    const text = readFileSync("src/lib/stats/fixtures/real-game.json", "utf8");
    const [t] = await db.query<{ id: number; name: string }>(
      `insert into trackers (name, token_hash) values ('PC', 'hash-a') returning id, name`,
    );

    const first = await recordGame({ id: t.id, name: t.name, account_id: null }, text, "acct-1", new Date("2026-09-20T00:00:00Z"));
    expect(first.ok).toBe(true);

    const rows = await db.query<{ name: string; games: number }>(`select name, games from snap_names`);
    expect(rows).toEqual([{ name: "LOCAL_PLAYER", games: 1 }]);

    // A second upload of the same game is a duplicate, but the name sighting still counts:
    // it is evidence the account was still using that name at that time.
    await recordGame({ id: t.id, name: t.name, account_id: null }, text, "acct-1", new Date("2026-09-21T00:00:00Z"));
    const [again] = await db.query<{ games: number; last_seen: Date }>(`select games, last_seen from snap_names`);
    expect(Number(again.games)).toBe(2);
    expect(again.last_seen.toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });
});
