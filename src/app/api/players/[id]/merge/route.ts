import { isAdmin } from "@/lib/auth/admin";
import { currentAccount } from "@/lib/auth/session";
import { applyMerge, planMerge } from "@/lib/leaderboard/merge";

export const dynamic = "force-dynamic";

/**
 * Preview, then apply, the same two steps the command line version has. The plan is never
 * accepted from the caller: it is worked out again here immediately before applying, so the
 * safety check runs against the database as it is now rather than as it was when previewed.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/players/[id]/merge">) {
  if (!isAdmin(await currentAccount())) {
    return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
  }

  const keepId = Number((await ctx.params).id);
  let body: { absorbId?: unknown; apply?: unknown };
  try {
    body = (await request.json()) as { absorbId?: unknown; apply?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const absorbId = Number(body.absorbId);
  if (!Number.isInteger(keepId) || !Number.isInteger(absorbId)) {
    return Response.json({ ok: false, error: "Give the id of the player to merge in." }, { status: 400 });
  }

  const planned = await planMerge(keepId, absorbId);
  if (!planned.ok) return Response.json({ ok: false, error: planned.error }, { status: 409 });

  if (body.apply !== true) return Response.json({ ok: true, applied: false, plan: planned.plan });

  await applyMerge(planned.plan);
  return Response.json({ ok: true, applied: true, plan: planned.plan });
}
