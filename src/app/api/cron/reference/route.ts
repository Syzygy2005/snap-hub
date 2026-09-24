import { cleanEnv } from "@/lib/env";
import { syncReference } from "@/lib/wiki/sync";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = cleanEnv("CRON_SECRET");
  if (secret ? request.headers.get("authorization")?.trim() !== `Bearer ${secret}` : process.env.NODE_ENV === "production")
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  // One after the other, never together. Both feeds come from the same host, and while they
  // were requested at once the locations feed alone was refused (HTTP 403) on nine of 67 runs.
  const results: PromiseSettledResult<Awaited<ReturnType<typeof syncReference>>>[] = [];
  for (const kind of ["cards", "locations"] as const) {
    results.push(await syncReference(kind).then(
      value => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason })));
  }
  const ok = results.every(r => r.status === "fulfilled");
  for (const result of results) if (result.status === "rejected") console.error("[reference]", result.reason);
  // This route is authenticated; report a bounded category without SQL or connection details.
  const failures = results.map((r, i) => r.status === "rejected" ? {
    kind: i === 0 ? "cards" : "locations",
    error: r.reason instanceof Error && /^Reference source returned HTTP \d{3}$/.test(r.reason.message)
      ? r.reason.message : "Import failed; inspect the reference sync server log",
  } : null).filter(Boolean);
  return Response.json({ ok, failures, cards: results[0].status, locations: results[1].status },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
