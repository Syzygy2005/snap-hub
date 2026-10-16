import { isAdmin } from "@/lib/auth/admin";
import { currentAccount } from "@/lib/auth/session";
import { removeDeck, renameDeck, setDeckListed, type DeckActor, type DeckChange } from "@/lib/decks/queries";

export const dynamic = "force-dynamic";

// The person who shared a deck can unlist, re-list or delete it; an admin can do that to any
// deck and rename it too. The check is here and in the query, never only in the UI.
async function actor(): Promise<DeckActor | null> {
  const account = await currentAccount();
  if (!account) return null;
  return isAdmin(account) ? { admin: true } : { accountId: account.id };
}

const signIn = () => Response.json({ ok: false, error: "Sign in to manage your decks." }, { status: 401 });

function refused(result: Exclude<DeckChange, "done">, listed?: boolean) {
  if (result === "missing") return Response.json({ ok: false, error: "That deck no longer exists." }, { status: 404 });
  if (result === "duplicate") {
    const side = listed ? "a public" : "an unlisted";
    return Response.json({ ok: false, error: `You already have ${side} copy of this deck with the same name. Delete one of them instead.` }, { status: 409 });
  }
  return Response.json({ ok: false, error: "Only the account that shared this deck can change it." }, { status: 403 });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/decks/[id]">) {
  const by = await actor();
  if (!by) return signIn();
  const { id } = await ctx.params;
  const result = await removeDeck(id, by);
  return result === "done" ? Response.json({ ok: true }) : refused(result);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/decks/[id]">) {
  const by = await actor();
  if (!by) return signIn();
  const { id } = await ctx.params;
  let body: { name?: unknown; listed?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; listed?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.listed === "boolean") {
    const result = await setDeckListed(id, body.listed, by);
    return result === "done" ? Response.json({ ok: true, listed: body.listed }) : refused(result, body.listed);
  }

  // Renaming stays moderation: an owner who wants a different name shares a new copy.
  if (typeof body.name === "string") {
    if (!("admin" in by)) return Response.json({ ok: false, error: "Only an admin can rename a shared deck." }, { status: 403 });
    const result = await renameDeck(id, body.name);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }
  return Response.json({ ok: false, error: "Send listed (true or false) or a name." }, { status: 400 });
}
