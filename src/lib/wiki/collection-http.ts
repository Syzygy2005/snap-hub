import { siteOrigin } from "@/lib/site-origin";
export const privateJson = (body: unknown, status=200) => Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export function sameOrigin(request: Request) {
  return !request.headers.get("origin") || request.headers.get("origin") === siteOrigin(request);
}
