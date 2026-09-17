import { cookies } from "next/headers";
import { authorizeUrl, discordConfig, newState, pkce } from "@/lib/auth/discord";
import { SIGNIN_COOKIE, signinCookie } from "@/lib/auth/session";
import { redirectUriFor, safeReturnTo } from "@/lib/auth/urls";
import { canonicalOrigin, siteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

// Starts the Discord round trip. The state and PKCE verifier ride along in a short-lived
// cookie rather than a table, so there is nothing to clean up if the visitor wanders off.
export async function GET(request: Request) {
  const config = discordConfig();
  const canonical = canonicalOrigin(request);
  if (!config) return Response.redirect(`${canonical}/?signin=unavailable`, 302);

  const params = new URL(request.url).searchParams;
  const returnTo = safeReturnTo(params.get("return"));

  // Cookies belong to one hostname, so a sign-in started on www would set its state there
  // and then never see it again on the apex Discord returns to. Move first, then start.
  // The marker makes this at most one hop, rather than a loop if the two never agree.
  if (params.get("canon") !== "1" && siteOrigin(request) !== canonical) {
    return Response.redirect(`${canonical}/api/auth/discord?canon=1&return=${encodeURIComponent(returnTo)}`, 302);
  }

  const state = newState();
  const { verifier, challenge } = pkce();

  const store = await cookies();
  store.set(SIGNIN_COOKIE, JSON.stringify({ state, verifier, returnTo }), signinCookie(canonical));

  return Response.redirect(
    authorizeUrl(config, { redirectUri: redirectUriFor(canonical), state, challenge }),
    302,
  );
}
