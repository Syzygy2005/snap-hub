import { isAdmin } from "@/lib/auth/admin";
import { currentAccount } from "@/lib/auth/session";
import { deleteFormerName } from "@/lib/leaderboard/queries";

export const dynamic = "force-dynamic";

// Drops a former-name record. Only the label goes: the player row and its history stay put,
// because a rename reused an existing row and there is no clean way to unpick that afterwards.
export async function DELETE(_request: Request, ctx: RouteContext<"/api/players/[id]/names/[nameId]">) {
  if (!isAdmin(await currentAccount())) {
    return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
  }
  const { id, nameId } = await ctx.params;
  const removed = await deleteFormerName(Number(id), Number(nameId));
  return Response.json({ ok: removed }, { status: removed ? 200 : 404 });
}
