import { currentAccount } from "@/lib/auth/session";
import { createTracker } from "@/lib/stats/tracker";

export async function POST(request: Request) {
  let body: { name?: unknown; inviteCode?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  // Made while signed in, so it lands on the account without a second step.
  const account = await currentAccount();
  const result = await createTracker(body, account?.id ?? null);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, token: result.token, name: result.tracker.name });
}
