import { currentAccount } from "@/lib/auth/session";
import { authenticate, claimTracker } from "@/lib/stats/tracker";

export const dynamic = "force-dynamic";

// Adds the tracker key in the Authorization header to the signed-in account, so its games
// show up wherever that account signs in. Both proofs are required: the key and the session.
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return Response.json({ ok: false, error: "Sign in first" }, { status: 401 });

  const tracker = await authenticate(request);
  if (!tracker) return Response.json({ ok: false, error: "Unknown tracker key" }, { status: 401 });

  const result = await claimTracker(tracker, account.id);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, name: result.tracker.name });
}
