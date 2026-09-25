/**
 * Every wiki section, in one place. The header menu, the wiki tabs, the breadcrumbs and the
 * sitemap all read this. It used to be written out by hand in five files, so adding a section
 * meant five edits and removing one meant finding every copy; missing one left a tab with no
 * breadcrumb label, or a sitemap entry for a page that no longer exists.
 *
 * Pure data, no database import, so client components can use it.
 */
export interface WikiSection {
  href: string;
  label: string;
  description: string;
  /** Breadcrumb text when it should differ from the tab label. */
  crumb?: string;
  /** Per-visitor pages stay out of the sitemap. */
  private?: boolean;
}

export const WIKI_SECTIONS: WikiSection[] = [
  { href: "/wiki", label: "Overview", description: "Explore the reference and guides" },
  { href: "/wiki/cards", label: "Cards", description: "Find costs, power and abilities" },
  { href: "/wiki/locations", label: "Locations", description: "Explore effects and rarities" },
  { href: "/wiki/variants", label: "Variants", description: "Browse and compare artwork" },
  { href: "/wiki/artists", label: "Artists", description: "Explore the people behind the art" },
  { href: "/wiki/my-collection", label: "My collection", description: "Owned variants and your wishlist", private: true },
  { href: "/wiki/archetypes", label: "Archetypes", description: "Learn a deck’s game plan" },
  { href: "/wiki/basics", label: "How to play", description: "Learn turns, snaps and retreats" },
  { href: "/wiki/game-modes", label: "Game modes", description: "Ranked, Conquest and events" },
  { href: "/wiki/terminology", label: "Terminology", description: "Understand SNAP shorthand" },
  { href: "/wiki/collection", label: "Collection", description: "Upgrades, variants and cosmetics", crumb: "Collection guide" },
  { href: "/wiki/history", label: "History", description: "Browse official patch notes" },
];

/** Breadcrumb text by path segment: every section, plus pages that are not tabs. */
export const WIKI_CRUMBS: Record<string, string> = {
  wiki: "Wiki",
  compare: "Compare",
  ...Object.fromEntries(
    WIKI_SECTIONS.filter((s) => s.href !== "/wiki").map((s) => [s.href.split("/").pop()!, s.crumb ?? s.label]),
  ),
};

/** Groups reference canonical sections without adding sitemap pages. */
export const WIKI_GROUPS = [
  { label: "Reference", hrefs: ["/wiki", "/wiki/cards", "/wiki/locations"] },
  { label: "Art & Collection", hrefs: ["/wiki/variants", "/wiki/artists", "/wiki/my-collection"] },
  { label: "Guides", hrefs: ["/wiki/basics", "/wiki/archetypes", "/wiki/game-modes", "/wiki/terminology", "/wiki/collection"] },
  { label: "History", hrefs: ["/wiki/history"] },
];

export function wikiSectionPath(pathname: string) {
  return WIKI_SECTIONS.find(({ href }) => href === pathname || (href !== "/wiki" && pathname.startsWith(href + "/")))?.href ?? "/wiki";
}
