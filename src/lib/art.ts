/**
 * Card, location and variant art is served through `/art/...` rather than hotlinked.
 *
 * Every image used to load straight from marvelsnapzone.com in the visitor's browser, and that
 * host refuses some of those requests with a 403, at random, on the card library, the location
 * atlas and the featured card alike. The same host refuses our own server now and then (see the
 * reference sync). Going through `/art` means the source is asked once per image and Vercel's
 * CDN answers everyone after that, so the visitor stops meeting the refusal and the source stops
 * carrying our traffic.
 *
 * Only this one directory of this one host is served, so the route cannot be used to fetch
 * anything else. Anything outside it, including the test fixtures' art, is returned unchanged.
 */
const HOST = "marvelsnapzone.com";
const PREFIX = ["wp-content", "themes", "blocksy-child", "assets", "media"];
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
const IMAGE = /\.(webp|png|jpe?g)$/i;
const VERSION = /^[\w.-]{1,40}$/;

function allowed(segments: string[], version: string | null) {
  return segments.length > PREFIX.length &&
    PREFIX.every((part, i) => segments[i] === part) &&
    segments.every(s => SEGMENT.test(s)) &&
    IMAGE.test(segments[segments.length - 1]) &&
    (version === null || VERSION.test(version));
}

/** The `src` to render for a stored art URL. */
export function artSrc(art: string): string {
  let url: URL;
  try { url = new URL(art); } catch { return art; }
  if (url.protocol !== "https:" || url.hostname !== HOST || url.port || url.username || url.password || url.hash) return art;
  const keys = [...url.searchParams.keys()];
  if (keys.some(k => k !== "v") || url.searchParams.getAll("v").length > 1) return art;
  const segments = url.pathname.split("/").slice(1);
  const version = url.searchParams.get("v");
  if (!allowed(segments, version)) return art;
  return `/art/${segments.join("/")}${version === null ? "" : `?v=${encodeURIComponent(version)}`}`;
}

/** The source URL an `/art` request stands for, or null when it is not one we serve. */
export function artSource(segments: string[], params: URLSearchParams): string | null {
  if ([...params.keys()].some(k => k !== "v") || params.getAll("v").length > 1) return null;
  const version = params.get("v");
  if (!allowed(segments, version)) return null;
  return `https://${HOST}/${segments.join("/")}${version === null ? "" : `?v=${encodeURIComponent(version)}`}`;
}

/** The pause before `/art` asks the source again. An object so tests can skip it. */
export const artPause = { wait: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)) };
