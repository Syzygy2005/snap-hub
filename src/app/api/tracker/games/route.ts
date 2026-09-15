import { gunzipSync } from "node:zlib";
import { authenticate, recordGame } from "@/lib/stats/tracker";

export const maxDuration = 30;

const MAX_BYTES = 20 * 1024 * 1024;

// The PC tracker posts GameState.json here after each game (gzip-compressed when it can).
export async function POST(request: Request) {
  const tracker = await authenticate(request);
  if (!tracker) return Response.json({ ok: false, error: "Unknown tracker key" }, { status: 401 });

  let bytes = Buffer.from(await request.arrayBuffer());
  if (request.headers.get("x-snaphub-encoding") === "gzip") {
    try {
      bytes = gunzipSync(bytes, { maxOutputLength: MAX_BYTES });
    } catch {
      return Response.json({ ok: false, error: "Could not decompress upload" }, { status: 400 });
    }
  }
  if (bytes.length > MAX_BYTES) return Response.json({ ok: false, error: "Upload too large" }, { status: 413 });

  const accountId = request.headers.get("x-snap-account-id")?.trim().slice(0, 100) || null;
  const result = await recordGame(tracker, bytes.toString("utf8"), accountId);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason, error: result.detail }, { status: result.status });
  }
  return Response.json(result);
}

// Lets the tracker check its key on startup.
export async function GET(request: Request) {
  const tracker = await authenticate(request);
  if (!tracker) return Response.json({ ok: false, error: "Unknown tracker key" }, { status: 401 });
  return Response.json({ ok: true, name: tracker.name });
}
