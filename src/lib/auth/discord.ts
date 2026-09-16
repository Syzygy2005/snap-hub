import { createHash, randomBytes } from "node:crypto";
import { cleanEnv } from "@/lib/env";

// Discord's endpoints, overridable so the flow can be exercised against a stub in tests.
export const DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize";
export const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
export const DISCORD_USER = "https://discord.com/api/users/@me";

export interface DiscordConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  userUrl?: string;
  fetch?: typeof globalThis.fetch;
}

/** null when the Discord app isn't configured, which is how sign-in stays hidden until it is. */
export function discordConfig(): DiscordConfig | null {
  const clientId = cleanEnv("DISCORD_CLIENT_ID");
  const clientSecret = cleanEnv("DISCORD_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    // Unset in production. Point these at a stub to walk the whole sign-in locally without
    // a Discord app, which is the only way this flow can be exercised end to end offline.
    authorizeUrl: cleanEnv("DISCORD_AUTHORIZE_URL") || undefined,
    tokenUrl: cleanEnv("DISCORD_TOKEN_URL") || undefined,
    userUrl: cleanEnv("DISCORD_USER_URL") || undefined,
  };
}

const base64url = (b: Buffer) => b.toString("base64url");

/** PKCE, so a stolen authorization code is useless without the verifier we kept. */
export function pkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  return { verifier, challenge: base64url(createHash("sha256").update(verifier).digest()) };
}

export function newState(): string {
  return base64url(randomBytes(24));
}

export function authorizeUrl(
  config: DiscordConfig,
  opts: { redirectUri: string; state: string; challenge: string },
): string {
  const url = new URL(config.authorizeUrl ?? DISCORD_AUTHORIZE);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  // identify is the whole ask: a user id, a name and an avatar. No email, no guilds.
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  // prompt is deliberately left at Discord's default, which always shows the consent screen.
  // prompt=none skips it for people who already approved the app and would be nicer on the
  // second sign-in, but its first-time behaviour could not be checked against real Discord
  // from here, and getting it wrong blocks every sign-in rather than degrading one.
  return url.toString();
}

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

export type ExchangeResult = { ok: true; user: DiscordUser } | { ok: false; error: string };

/** Trades the one-time code for a token, then reads the profile it unlocks. */
export async function exchangeCode(
  config: DiscordConfig,
  opts: { code: string; verifier: string; redirectUri: string },
): Promise<ExchangeResult> {
  const doFetch = config.fetch ?? globalThis.fetch;
  let accessToken: string;
  try {
    const res = await doFetch(config.tokenUrl ?? DISCORD_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code: opts.code,
        redirect_uri: opts.redirectUri,
        code_verifier: opts.verifier,
      }).toString(),
    });
    if (!res.ok) return { ok: false, error: `Discord rejected the sign-in (${res.status})` };
    const body = (await res.json()) as { access_token?: unknown };
    if (typeof body.access_token !== "string" || !body.access_token) {
      return { ok: false, error: "Discord did not return an access token" };
    }
    accessToken = body.access_token;
  } catch {
    return { ok: false, error: "Could not reach Discord" };
  }

  try {
    const res = await doFetch(config.userUrl ?? DISCORD_USER, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, error: `Could not read your Discord profile (${res.status})` };
    const body = (await res.json()) as { id?: unknown; username?: unknown; avatar?: unknown };
    if (typeof body.id !== "string" || !body.id) return { ok: false, error: "Discord profile had no id" };
    return {
      ok: true,
      user: {
        id: body.id,
        username: typeof body.username === "string" && body.username ? body.username.slice(0, 32) : "Someone",
        avatar: typeof body.avatar === "string" && body.avatar ? body.avatar.slice(0, 64) : null,
      },
    };
  } catch {
    return { ok: false, error: "Could not reach Discord" };
  }
}

/** Discord serves avatars from a CDN path built out of the id and hash. */
export function avatarUrl(discordId: string, avatar: string | null): string | null {
  return avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64` : null;
}
