import { currentAccount } from "@/lib/auth/session";
import { savedVariants, setVariant } from "@/lib/wiki/collection";
import { privateJson, sameOrigin } from "@/lib/wiki/collection-http";

export const dynamic = "force-dynamic";
export async function GET() {
  const account = await currentAccount();
  return account ? privateJson(await savedVariants(account.id)) : privateJson({error:"Sign in to save variants."},401);
}
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return privateJson({error:"Please use this site's collection controls."},403);
  const account = await currentAccount();
  if (!account) return privateJson({error:"Sign in to save variants."},401);
  const body = await request.json().catch(()=>null);
  if (!body || typeof body.card!=="string" || !body.card || body.card.length>160 || typeof body.variant!=="string" || !body.variant || body.variant.length>160 || ![null,"owned","wanted"].includes(body.status)) return privateJson({error:"Invalid variant selection."},400);
  try { await setVariant(account.id,body.card,body.variant,body.status); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("Choose a listed")) return privateJson({error:error.message},400);
    console.error("Collection save failed",error);
    return privateJson({error:"Couldn't save. Please try again."},500);
  }
  return privateJson({ok:true});
}
