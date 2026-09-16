import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

export const SESSION_COOKIE = "snaphub_session";
export const SIGNIN_COOKIE = "snaphub_signin";
const SESSION_DAYS = 30;
const SIGNIN_MINUTES = 10;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export interface Account {
  id: number;
  discordId: string;
  username: string;
  avatar: string | null;
}

interface AccountRow {
  id: number;
  discord_id: string;
  username: string;
  avatar: string | null;
}

const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  discordId: r.discord_id,
  username: r.username,
  avatar: r.avatar,
});

/** One row per Discord user. Signing in again refreshes the name and avatar they chose. */
export async function upsertAccount(user: { id: string; username: string; avatar: string | null }): Promise<Account> {
  const db = await getDb();
  const [row] = await db.query<AccountRow>(
    `insert into accounts (discord_id, username, avatar) values ($1, $2, $3)
     on conflict (discord_id) do update
       set username = excluded.username, avatar = excluded.avatar, last_seen_at = now()
     returning id, discord_id, username, avatar`,
    [user.id, user.username, user.avatar],
  );
  return toAccount(row);
}

/** Only the hash is stored, so the table is useless to anyone who reads it. */
export async function createSession(accountId: number, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  const db = await getDb();
  await db.query(`insert into sessions (token_hash, account_id, expires_at) values ($1, $2, $3)`, [
    sha256(token),
    accountId,
    expiresAt,
  ]);
  return { token, expiresAt };
}

export async function accountForToken(token: string | undefined, now = new Date()): Promise<Account | null> {
  if (!token) return null;
  const db = await getDb();
  const [row] = await db.query<AccountRow>(
    `select a.id, a.discord_id, a.username, a.avatar
       from sessions s join accounts a on a.id = s.account_id
      where s.token_hash = $1 and s.expires_at > $2`,
    [sha256(token), now],
  );
  return row ? toAccount(row) : null;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  const db = await getDb();
  await db.query(`delete from sessions where token_hash = $1`, [sha256(token)]);
}

/** Expired rows are only cleared when someone signs in, which is often enough for a table this size. */
export async function pruneSessions(now = new Date()): Promise<void> {
  const db = await getDb();
  await db.query(`delete from sessions where expires_at <= $1`, [now]);
}

/** Who is signed in, for Server Components and route handlers. */
export async function currentAccount(): Promise<Account | null> {
  const store = await cookies();
  return accountForToken(store.get(SESSION_COOKIE)?.value);
}

/** Secure cookies are dropped over plain http, which is how the site runs locally. */
export const cookieOptions = (origin: string) =>
  ({
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax" as const,
    path: "/",
  });

export const sessionCookie = (origin: string, expiresAt: Date) => ({ ...cookieOptions(origin), expires: expiresAt });

export const signinCookie = (origin: string) => ({ ...cookieOptions(origin), maxAge: SIGNIN_MINUTES * 60 });
