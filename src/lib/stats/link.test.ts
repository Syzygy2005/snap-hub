import { describe, expect, it } from "vitest";
import { upsertAccount } from "@/lib/auth/session";
import { getPersonalStats } from "./queries";
import { claimTracker, createTracker, trackersForAccount } from "./tracker";

const newKey = async (name: string, accountId?: number) => {
  const r = await createTracker({ name }, accountId);
  if (!r.ok) throw new Error(r.error);
  return r.tracker;
};

describe("linking tracker keys to an account", () => {
  it("allows only one account to win simultaneous claims", async () => {
    const a = await upsertAccount({ id: "race-a", username: "A", avatar: null });
    const b = await upsertAccount({ id: "race-b", username: "B", avatar: null });
    const tracker = await newKey("Contested key");
    const results = await Promise.all([claimTracker(tracker, a.id), claimTracker(tracker, b.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ status: 409 });
    const winner = results[0].ok ? a : b;
    const loser = results[0].ok ? b : a;
    expect(await trackersForAccount(winner.id)).toHaveLength(1);
    expect(await trackersForAccount(loser.id)).toHaveLength(0);
    expect(await claimTracker(tracker, loser.id)).toMatchObject({ ok: false, status: 409 });
  });

  it("a key made while signed in lands on the account already", async () => {
    const account = await upsertAccount({ id: "d-auto", username: "noah", avatar: null });
    const tracker = await newKey("Desktop", account.id);
    expect((await trackersForAccount(account.id)).map((t) => t.id)).toEqual([tracker.id]);
  });

  it("a key made signed out belongs to nobody until it is claimed", async () => {
    const account = await upsertAccount({ id: "d-claim", username: "noah", avatar: null });
    const tracker = await newKey("Laptop");
    expect(await trackersForAccount(account.id)).toEqual([]);

    expect(await claimTracker(tracker, account.id)).toMatchObject({ ok: true });
    expect((await trackersForAccount(account.id)).map((t) => t.id)).toEqual([tracker.id]);
  });

  it("claiming the same key twice is harmless", async () => {
    const account = await upsertAccount({ id: "d-twice", username: "noah", avatar: null });
    const tracker = await newKey("Phone");
    await claimTracker(tracker, account.id);
    expect(await claimTracker(tracker, account.id)).toMatchObject({ ok: true });
    expect(await trackersForAccount(account.id)).toHaveLength(1);
  });

  it("refuses to move a key that is already on someone else's account", async () => {
    const mine = await upsertAccount({ id: "d-mine", username: "noah", avatar: null });
    const theirs = await upsertAccount({ id: "d-theirs", username: "someone", avatar: null });
    const tracker = await newKey("Shared");
    await claimTracker(tracker, theirs.id);

    expect(await claimTracker(tracker, mine.id)).toMatchObject({ ok: false, status: 409 });
    expect(await trackersForAccount(mine.id)).toEqual([]);
    expect((await trackersForAccount(theirs.id)).map((t) => t.id)).toEqual([tracker.id]);
  });

  it("an account keeps several keys, and they stay in one list", async () => {
    const account = await upsertAccount({ id: "d-many", username: "noah", avatar: null });
    const a = await newKey("Desktop", account.id);
    const b = await newKey("Handheld");
    await claimTracker(b, account.id);
    expect((await trackersForAccount(account.id)).map((t) => t.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("deleting an account releases its keys instead of destroying them", async () => {
    const account = await upsertAccount({ id: "d-gone", username: "noah", avatar: null });
    const tracker = await newKey("Desktop", account.id);

    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    await db.query(`delete from accounts where id = $1`, [account.id]);

    const [row] = await db.query<{ id: number; account_id: number | null }>(
      `select id, account_id from trackers where id = $1`,
      [tracker.id],
    );
    expect(row).toMatchObject({ id: tracker.id, account_id: null });
  });
});

describe("stats across several keys", () => {
  it("shows nothing rather than everyone's games when an account has no keys", async () => {
    const account = await upsertAccount({ id: "d-empty", username: "noah", avatar: null });
    const stats = await getPersonalStats({ id: account.id, name: account.username, trackerIds: [] }, "all");
    expect(stats.summary.games).toBe(0);
    expect(stats.recent).toEqual([]);
    expect(stats.decks).toEqual([]);
    expect(stats.tracker.name).toBe("noah");
  });
});
