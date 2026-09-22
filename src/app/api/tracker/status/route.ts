import { authenticate } from "@/lib/stats/tracker";

export async function GET(request: Request) {
  const tracker = await authenticate(request);
  if (!tracker) return Response.json({ ok: false, error: "Tracker key not recognised. Check your key or create a new one." }, { status: 401 });
  // authenticate already read this row; selecting last_upload_at there halves a poll that the
  // setup page repeats every 15 seconds for as long as the tab is open.
  return Response.json({ ok: true, lastUploadAt: tracker.last_upload_at?.toISOString() ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
