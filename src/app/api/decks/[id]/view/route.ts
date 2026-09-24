import { currentAccount } from "@/lib/auth/session";
import { countDeckView } from "@/lib/decks/queries";
import { sameOrigin } from "@/lib/http";

// Posted by CountView on the deck page. Another site cannot run up a deck's count through a
// visitor's browser; a script calling this directly still can, and nothing ranks by views.
export async function POST(request: Request, ctx: RouteContext<"/api/decks/[id]/view">) {
  if (!sameOrigin(request)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const account = await currentAccount();
  const counted = await countDeckView(id, account?.id ?? null);
  return Response.json({ ok: true, counted }, { headers: { "Cache-Control": "no-store" } });
}
