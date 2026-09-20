import { isAdmin } from "@/lib/auth/admin";
import { currentAccount } from "@/lib/auth/session";
import { claimForPlayer, claimPlayer, releaseClaim, verifyClaim } from "@/lib/leaderboard/claims";

export const dynamic = "force-dynamic";

function playerId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Claim a player row as yourself. Signed in only, and only ever for your own account. */
export async function POST(_request: Request, ctx: RouteContext<"/api/players/[id]/claim">) {
  const account = await currentAccount();
  if (!account) return Response.json({ ok: false, error: "Sign in first" }, { status: 401 });
  const id = playerId((await ctx.params).id);
  if (id === null) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  // The account is taken from the session, never from the request: nobody claims on behalf
  // of somebody else.
  const result = await claimPlayer(id, account.id);
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

/** Give up a claim. Yours, or anybody's if you moderate. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/players/[id]/claim">) {
  const account = await currentAccount();
  if (!account) return Response.json({ ok: false, error: "Sign in first" }, { status: 401 });
  const id = playerId((await ctx.params).id);
  if (id === null) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  const removed = await releaseClaim(id, isAdmin(account) ? null : account.id);
  return Response.json({ ok: removed }, { status: removed ? 200 : 404 });
}

/** Confirm somebody's claim, for a player who does not run the tracker. Admin only. */
export async function PATCH(_request: Request, ctx: RouteContext<"/api/players/[id]/claim">) {
  const account = await currentAccount();
  if (!isAdmin(account)) return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
  const id = playerId((await ctx.params).id);
  if (id === null) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  const claim = await verifyClaim(id);
  if (!claim) {
    const existing = await claimForPlayer(id);
    return Response.json(
      { ok: false, error: existing ? "That claim is already confirmed." : "Nobody has claimed that player." },
      { status: 404 },
    );
  }
  return Response.json({ ok: true, claim });
}
