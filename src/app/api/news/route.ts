import { isAdmin } from "@/lib/auth/admin";
import { currentAccount } from "@/lib/auth/session";
import { createNews } from "@/lib/news/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Checked here, not only in the UI: hiding the form hides nothing.
  const account = await currentAccount();
  if (!account || !isAdmin(account)) return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const result = await createNews(body as Record<string, unknown>, account.id);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
