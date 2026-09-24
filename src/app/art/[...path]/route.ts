import { artPause, artSource } from "@/lib/art";

// A versioned image (`?v=`) never changes under the same URL; the source bumps the version
// when the art changes, which is a new URL and a new cache entry. Unversioned art is held for
// less time in case it is replaced in place. Both lengths are a choice, not a measurement.
const VERSIONED = "public, max-age=31536000, s-maxage=31536000, immutable";
const UNVERSIONED = "public, max-age=86400, s-maxage=604800";
const BITMAP = new Set(["image/webp", "image/png", "image/jpeg"]);

export async function GET(request: Request, ctx: RouteContext<"/art/[...path]">) {
  const { path } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const source = artSource(path, params);
  if (!source) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  let status = 502;
  for (let attempt = 0; attempt < 2; attempt++) {
    const upstream = await fetch(source, { cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SnapHub art cache)" } }).catch(() => null);
    // Bitmaps only. An SVG answered from our own origin could carry script.
    const type = (upstream?.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (upstream?.ok && BITMAP.has(type)) {
      return new Response(upstream.body, { headers: { "Content-Type": type,
        "Cache-Control": params.has("v") ? VERSIONED : UNVERSIONED, "X-Content-Type-Options": "nosniff" } });
    }
    status = upstream && !upstream.ok ? upstream.status : 502;
    // Only a refusal or a source fault is worth asking again; a 404 will still be a 404.
    if (upstream && upstream.ok) break;
    if (upstream && upstream.status < 500 && upstream.status !== 403 && upstream.status !== 429) break;
    if (attempt === 0) await artPause.wait(1_000);
  }
  // Never cache a failure: the next visitor should get another try at the source.
  return new Response(null, { status: status === 404 ? 404 : 502, headers: { "Cache-Control": "no-store" } });
}
