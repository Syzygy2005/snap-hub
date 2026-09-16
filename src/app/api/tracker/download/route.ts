import { readFile } from "node:fs/promises";
import path from "node:path";
import { authenticate } from "@/lib/stats/tracker";
import { SCRIPT_NAME, siteOrigin, trackerBundle } from "@/lib/tracker/download";
import { zip } from "@/lib/tracker/zip";

export const dynamic = "force-dynamic";

/**
 * Hands back a zip holding the tracker script plus a launcher that already knows the site
 * and the caller's key, so setup is download, unzip, double-click.
 */
export async function GET(request: Request) {
  const tracker = await authenticate(request);
  if (!tracker) return Response.json({ ok: false, error: "Unknown tracker key" }, { status: 401 });

  // authenticate() already matched this shape; re-read it so only that shape is ever embedded.
  const key = /^Bearer\s+(shk_[\w-]{20,})$/.exec((request.headers.get("authorization") ?? "").trim())?.[1];
  if (!key) return Response.json({ ok: false, error: "Unknown tracker key" }, { status: 401 });

  let script: Buffer;
  try {
    script = await readFile(path.join(process.cwd(), "public", "tracker", SCRIPT_NAME));
  } catch {
    return Response.json({ ok: false, error: "Tracker script is missing on the server" }, { status: 500 });
  }

  const archive = zip(trackerBundle({ site: siteOrigin(request), key, name: tracker.name, script }));

  return new Response(new Uint8Array(archive), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="snap-hub-tracker.zip"',
      "cache-control": "no-store",
    },
  });
}
