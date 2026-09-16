import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// POST only: a signed-out visitor should never be caused by following a link or loading an image.
export async function POST(request: Request) {
  const store = await cookies();
  await destroySession(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  const returnTo = new URL(request.url).searchParams.get("return");
  return Response.json({ ok: true, returnTo: returnTo ?? "/" });
}
