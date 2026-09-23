import { artists } from "@/lib/wiki/variant-browser";
import { artistHref } from "@/lib/wiki/variant-key";
import { ARCHETYPES } from "@/lib/wiki/archetypes";
import type { MetadataRoute } from "next";
import { entries } from "@/lib/wiki/queries";
import { canonicalOrigin } from "@/lib/site-origin";
import { WIKI_GUIDES } from "@/lib/wiki/guides";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = canonicalOrigin(new Request("https://snap-hub.app"));
  const collections = await Promise.all([entries("cards"), entries("locations")]);
  return ["/", "/wiki", "/wiki/cards", "/wiki/locations", "/wiki/variants", "/wiki/history", "/wiki/artists", "/wiki/archetypes", "/wiki/interactions", ...ARCHETYPES.map(a=>"/wiki/archetypes/"+a.slug), ...(await artists()).map(a=>artistHref(a.name)), ...WIKI_GUIDES.map(g=>`/wiki/${g.slug}`), ...collections.flatMap((items,i) => items.filter(e => e.status === "released").map(e => `/wiki/${i === 0 ? "cards" : "locations"}/${encodeURIComponent(e.def_id)}`))].map(path => ({url: origin+path}));
}
