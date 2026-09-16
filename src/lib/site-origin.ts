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
