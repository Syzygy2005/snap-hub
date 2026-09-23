import { artists } from "@/lib/wiki/variant-browser";
import { artistHref } from "@/lib/wiki/variant-key";
import { ARCHETYPES } from "@/lib/wiki/archetypes";
import type { MetadataRoute } from "next";
import { entries } from "@/lib/wiki/queries";
import { canonicalOrigin } from "@/lib/site-origin";
import { WIKI_GUIDES } from "@/lib/wiki/guides";
import { WIKI_SECTIONS } from "@/lib/wiki/sections";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = canonicalOrigin(new Request("https://snap-hub.app"));
  const collections = await Promise.all([entries("cards"), entries("locations")]);
  // Sections come from the shared list, minus per-visitor pages. Guides are added too and the
  // Set drops the overlap, so a guide added without a tab still reaches the sitemap.
  const pages = new Set(["/", ...WIKI_SECTIONS.filter(s => !s.private).map(s => s.href), ...WIKI_GUIDES.map(g=>`/wiki/${g.slug}`)]);
  return [...pages, ...ARCHETYPES.map(a=>"/wiki/archetypes/"+a.slug), ...(await artists()).map(a=>artistHref(a.name)), ...collections.flatMap((items,i) => items.filter(e => e.status === "released").map(e => `/wiki/${i === 0 ? "cards" : "locations"}/${encodeURIComponent(e.def_id)}`))].map(path => ({url: origin+path}));
}
