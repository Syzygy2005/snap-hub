import { cookies } from "next/headers";
import { discordConfig, exchangeCode } from "@/lib/auth/discord";
import {
  createSession,
  pruneSessions,
  SESSION_COOKIE,
  SIGNIN_COOKIE,
  sessionCookie,
  upsertAccount,
} from "@/lib/auth/session";
import { redirectUriFor, safeReturnTo } from "@/lib/auth/urls";
import { siteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

interface Pending {
  state: string;
  verifier: string;
  returnTo: string;
}

function readPending(raw: string | undefined): Pending | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.state !== "string" || typeof v.verifier !== "string") return null;
    return { state: v.state, verifier: v.verifier, returnTo: safeReturnTo(v.returnTo as string) };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const origin = siteOrigin(request);
  const store = await cookies();
  const fail = (why: string) => {
    store.delete(SIGNIN_COOKIE);
    return Response.redirect(`${origin}/?signin=${why}`, 302);
  };

  const config = discordConfig();
  if (!config) return fail("unavailable");

  const params = new URL(request.url).searchParams;
  // Discord sends error=access_denied when someone changes their mind on its consent screen.
  if (params.get("error")) return fail("cancelled");

  const pending = readPending(store.get(SIGNIN_COOKIE)?.value);
  const state = params.get("state");
  const code = params.get("code");
  // A mismatch means this callback did not start here, so it is never exchanged.
  if (!pending || !state || !code || state !== pending.state) return fail("expired");

  const result = await exchangeCode(config, { code, verifier: pending.verifier, redirectUri: redirectUriFor(origin) });
  if (!result.ok) return fail("failed");

  const account = await upsertAccount(result.user);
  const { token, expiresAt } = await createSession(account.id);
  await pruneSessions();

  store.delete(SIGNIN_COOKIE);
  store.set(SESSION_COOKIE, token, sessionCookie(origin, expiresAt));
  return Response.redirect(`${origin}${pending.returnTo}`, 302);
}
