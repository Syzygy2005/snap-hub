import { cleanEnv } from "@/lib/env";

const first = (value: string | null) => value?.split(",")[0]?.trim() || null;

/**
 * The address the visitor actually used. `request.url` carries whatever address the server
 * itself is bound to and ignores the Host header, so a proxy's forwarded headers decide.
 * Anything that isn't a plain scheme and host is ignored, because callers paste this into
 * a quoted batch argument and an OAuth redirect URL.
 */
export function siteOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host"));
  const proto = first(request.headers.get("x-forwarded-proto")) ?? url.protocol.replace(":", "");
  const usable = !!host && /^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host) && /^https?$/.test(proto);
  return usable ? `${proto}://${host}` : url.origin;
}

/**
 * Accepts only a plain http(s) origin, since this ends up in redirects and an OAuth parameter.
 *
 * The hostname has to be dotted, or localhost. cleanEnv strips whitespace out of the value, so
 * a mistyped "snap hub app" arrives as one word, and prefixing a scheme would otherwise turn it
 * into the perfectly parseable https://snaphubapp and point sign-in at nowhere.
 */
function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * The one address sign-in runs on, whichever hostname the visitor arrived at.
 *
 * Deriving it per request breaks OAuth as soon as a site answers on more than one name:
 * Discord matches the redirect literally, so arriving at www when the apex is registered is
 * rejected, and Vercel's per-deployment hostnames are never registered at all. Sessions are
 * scoped to a hostname too, so two working names would mean two parallel sign-ins.
 *
 * SITE_URL pins it explicitly. Otherwise Vercel names the project's production domain, the
 * same variable layout.ts already uses for metadataBase. Locally neither is set and the
 * address the request came in on is right.
 */
export function canonicalOrigin(request: Request): string {
  const explicit = cleanEnv("SITE_URL");
  const configured = explicit ?? cleanEnv("VERCEL_PROJECT_PRODUCTION_URL");
  return (configured ? normalizeOrigin(configured) : null) ?? siteOrigin(request);
}
