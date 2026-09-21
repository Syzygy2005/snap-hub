import { cleanEnv } from "@/lib/env";
import { syncReference } from "@/lib/wiki/sync";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = cleanEnv("CRON_SECRET");
  if (secret ? request.headers.get("authorization")?.trim() !== `Bearer ${secret}` : process.env.NODE_ENV === "production")
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const results = await Promise.allSettled([syncReference("cards"), syncReference("locations")]);
  const ok = results.every(r => r.status === "fulfilled");
  for (const result of results) if (result.status === "rejected") console.error("[reference]", result.reason);
  return Response.json({ ok, cards: results[0].status, locations: results[1].status },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
