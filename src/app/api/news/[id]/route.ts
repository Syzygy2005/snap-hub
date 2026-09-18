import { isAdmin } from "@/lib/auth/admin";
import { currentAccount } from "@/lib/auth/session";
import { deleteNews, updateNews } from "@/lib/news/queries";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  return isAdmin(await currentAccount());
}

function newsId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/news/[id]">) {
  if (!(await requireAdmin())) return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
  const id = newsId((await ctx.params).id);
  if (id === null) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const result = await updateNews(id, body as Record<string, unknown>);
  if (result === null) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/news/[id]">) {
  if (!(await requireAdmin())) return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
  const id = newsId((await ctx.params).id);
  if (id === null) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  const removed = await deleteNews(id);
  return Response.json({ ok: removed }, { status: removed ? 200 : 404 });
}
