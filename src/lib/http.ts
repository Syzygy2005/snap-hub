import { siteOrigin } from "@/lib/site-origin";
// Response helpers for routes that answer about one signed-in person.
/** JSON that no cache or proxy may keep, because it belongs to whoever asked. */
export const privateJson = (body: unknown, status=200) => Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export function sameOrigin(request: Request) {
  return !request.headers.get("origin") || request.headers.get("origin") === siteOrigin(request);
}
