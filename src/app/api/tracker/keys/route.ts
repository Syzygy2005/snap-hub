import { currentAccount } from "@/lib/auth/session";
import { createTracker } from "@/lib/stats/tracker";

export async function POST(request: Request) {
  let body: { name?: unknown; inviteCode?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  // A key needs an account. Anyone could mint one before, and with a key any hand-edited game
  // file lands in the community stats, which one person faking uploads could dominate. An
  // account is someone an admin can act on; the key lands on it without a second step.
  const account = await currentAccount();
  if (!account) {
    return Response.json({ ok: false, error: "Sign in with Discord to make a tracker key." }, { status: 401 });
  }
  const result = await createTracker(body, account.id);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, token: result.token, name: result.tracker.name });
}
