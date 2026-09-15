import { saveDeck } from "@/lib/decks/queries";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const result = await saveDeck((body ?? {}) as { name?: unknown; cards?: unknown });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
