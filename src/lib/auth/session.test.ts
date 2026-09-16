import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { accountForToken, createSession, destroySession, pruneSessions, upsertAccount } from "./session";

const user = (id: string, username = "noah", avatar: string | null = "hash1") => ({ id, username, avatar });

describe("accounts", () => {
  it("creates one row per Discord user and refreshes the name and avatar on return", async () => {
    const first = await upsertAccount(user("d-1", "noah", "hash1"));
    const again = await upsertAccount(user("d-1", "noah-renamed", "hash2"));
    expect(again.id).toBe(first.id);
    expect(again.username).toBe("noah-renamed");
    expect(again.avatar).toBe("hash2");

    const other = await upsertAccount(user("d-2"));
    expect(other.id).not.toBe(first.id);
  });
});

describe("sessions", () => {
  it("hands back a token that resolves to the account", async () => {
    const account = await upsertAccount(user("d-token"));
    const { token } = await createSession(account.id);
    const found = await accountForToken(token);
    expect(found?.id).toBe(account.id);
    expect(found?.username).toBe("noah");
  });

  it("never stores the token itself", async () => {
    const account = await upsertAccount(user("d-hash"));
    const { token } = await createSession(account.id);
    const db = await getDb();
    const rows = await db.query<{ token_hash: string }>(`select token_hash from sessions`);
    expect(rows.some((r) => r.token_hash === token)).toBe(false);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("rejects an unknown, empty or expired token", async () => {
    const account = await upsertAccount(user("d-exp"));
    expect(await accountForToken(undefined)).toBeNull();
    expect(await accountForToken("nonsense")).toBeNull();

    const { token } = await createSession(account.id, new Date(Date.now() - 400 * 86_400_000));
    expect(await accountForToken(token)).toBeNull();
  });

  it("signing out invalidates only that session", async () => {
    const account = await upsertAccount(user("d-out"));
    const phone = await createSession(account.id);
    const laptop = await createSession(account.id);

    await destroySession(phone.token);
    expect(await accountForToken(phone.token)).toBeNull();
    expect(await accountForToken(laptop.token)).not.toBeNull();
  });

  it("pruning clears expired rows and leaves live ones", async () => {
    const account = await upsertAccount(user("d-prune"));
    await createSession(account.id, new Date(Date.now() - 400 * 86_400_000));
    const live = await createSession(account.id);

    await pruneSessions();
    const db = await getDb();
    const [{ n }] = await db.query<{ n: number }>(
      `select count(*)::int as n from sessions where expires_at <= now()`,
    );
    expect(n).toBe(0);
    expect(await accountForToken(live.token)).not.toBeNull();
  });

  it("deleting an account takes its sessions with it", async () => {
    const account = await upsertAccount(user("d-cascade"));
    const { token } = await createSession(account.id);
    const db = await getDb();
    await db.query(`delete from accounts where id = $1`, [account.id]);
    expect(await accountForToken(token)).toBeNull();
  });
});
