import { isAdmin } from "@/lib/auth/admin";
import { currentAccount } from "@/lib/auth/session";
import { deleteDeck, renameDeck } from "@/lib/decks/queries";

export const dynamic = "force-dynamic";

// Moderation. The check is here rather than only in the UI: hiding a button hides nothing.
async function requireAdmin() {
  return isAdmin(await currentAccount());
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/decks/[id]">) {
  if (!(await requireAdmin())) return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
  const { id } = await ctx.params;
  const removed = await deleteDeck(id);
  return Response.json({ ok: removed }, { status: removed ? 200 : 404 });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/decks/[id]">) {
  if (!(await requireAdmin())) return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
  const { id } = await ctx.params;
  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.name !== "string") return Response.json({ ok: false, error: "Name must be text" }, { status: 400 });
  const result = await renameDeck(id, body.name);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
