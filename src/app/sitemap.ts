import type { MetadataRoute } from "next";
import { entries } from "@/lib/wiki/queries";
import { canonicalOrigin } from "@/lib/site-origin";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = canonicalOrigin(new Request("https://snap-hub.app"));
  const collections = await Promise.all([entries("cards"), entries("locations")]);
  return ["/", "/wiki", "/wiki/cards", "/wiki/locations", "/wiki/history", ...collections.flatMap((items,i) => items.filter(e => e.status === "released").map(e => `/wiki/${i === 0 ? "cards" : "locations"}/${encodeURIComponent(e.def_id)}`))].map(path => ({url: origin+path}));
}
