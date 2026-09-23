import { currentAccount } from "@/lib/auth/session";
import { disableShare, enableShare } from "@/lib/wiki/collection";
import { privateJson, sameOrigin } from "@/lib/wiki/collection-http";

async function change(request: Request, enabled: boolean) {
  if (!sameOrigin(request)) return privateJson({error:"Please use this site's collection controls."},403);
  const account = await currentAccount();
  if (!account) return privateJson({error:"Sign in to share your wishlist."},401);
  try {
    const token = enabled ? await enableShare(account.id) : (await disableShare(account.id),null);
    return privateJson({token});
  } catch (error) {
    console.error("Wishlist sharing failed",error);
    return privateJson({error:"Couldn't update sharing. Please try again."},500);
  }
}
export const POST = (request: Request) => change(request,true);
export const DELETE = (request: Request) => change(request,false);
