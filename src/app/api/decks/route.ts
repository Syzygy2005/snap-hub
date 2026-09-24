import { currentAccount } from "@/lib/auth/session";
import { saveDeck } from "@/lib/decks/queries";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  // Signed in, the deck carries their name. Signed out it can still be shared by link, but only
  // an account may list it on the Decks page: with no sign-in and no limit, a script could fill
  // the public directory, and the only guard was an exact duplicate of name and cards.
  const account = await currentAccount();
  if (!account && (body as { listed?: unknown } | null)?.listed !== false) {
    return Response.json(
      { ok: false, error: "Sign in with Discord to list a deck on the Decks page. You can still share it unlisted." },
      { status: 401 },
    );
  }
  const result = await saveDeck((body ?? {}) as { name?: unknown; cards?: unknown }, account?.id ?? null);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
