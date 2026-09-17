import { currentAccount } from "@/lib/auth/session";
import { saveDeck } from "@/lib/decks/queries";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  // Signed in, the deck carries their name. Signed out it stays anonymous, as before.
  const account = await currentAccount();
  const result = await saveDeck((body ?? {}) as { name?: unknown; cards?: unknown }, account?.id ?? null);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
