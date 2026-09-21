import { currentAccount } from "@/lib/auth/session";
import { accountDecks, saveAccountDeck, deleteAccountDeck } from "@/lib/decks/account";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  const account = await currentAccount();
  return account ? json({ ok: true, decks: await accountDecks(account.id) }) : json({ ok: false, error: "Sign in to sync private decks." }, 401);
}

export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return json({ ok: false, error: "Sign in to sync private decks." }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "Invalid deck" }, 400);
  const result = await saveAccountDeck(account.id, body);
  return json(result, result.ok ? 200 : result.status);
}

export async function DELETE(request: Request) {
  const account = await currentAccount();
  if (!account) return json({ ok: false, error: "Sign in first." }, 401);
  const id = new URL(request.url).searchParams.get("id");
  const removed = id ? await deleteAccountDeck(account.id, id) : false;
  return json({ ok: removed }, removed ? 200 : 404);
}
