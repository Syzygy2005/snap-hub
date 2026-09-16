import { cookies } from "next/headers";
import { authorizeUrl, discordConfig, newState, pkce } from "@/lib/auth/discord";
import { SIGNIN_COOKIE, signinCookie } from "@/lib/auth/session";
import { redirectUriFor, safeReturnTo } from "@/lib/auth/urls";
import { siteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

// Starts the Discord round trip. The state and PKCE verifier ride along in a short-lived
// cookie rather than a table, so there is nothing to clean up if the visitor wanders off.
export async function GET(request: Request) {
  const config = discordConfig();
  const origin = siteOrigin(request);
  if (!config) return Response.redirect(`${origin}/?signin=unavailable`, 302);

  const state = newState();
  const { verifier, challenge } = pkce();
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("return"));

  const store = await cookies();
  store.set(SIGNIN_COOKIE, JSON.stringify({ state, verifier, returnTo }), signinCookie(origin));

  return Response.redirect(
    authorizeUrl(config, { redirectUri: redirectUriFor(origin), state, challenge }),
    302,
  );
}
