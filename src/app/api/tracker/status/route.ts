import { authenticate } from "@/lib/stats/tracker";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const tracker = await authenticate(request);
  if (!tracker) return Response.json({ ok: false, error: "Tracker key not recognised. Check your key or create a new one." }, { status: 401 });
  const db = await getDb();
  const [row] = await db.query<{ last_upload_at: Date | null }>("select last_upload_at from trackers where id = $1", [tracker.id]);
  return Response.json({ ok: true, lastUploadAt: row?.last_upload_at?.toISOString() ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
