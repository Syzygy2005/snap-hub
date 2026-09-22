

interface SnapZoneCard {
  name: string;
  type: string;
  cost: number;
  power: number;
  ability: string;
  art: string;
  status: string;
  carddefid: string;
  source: string;
  tags: { tag: string }[];
  variants: unknown[];
}

export interface CardRecord {
  defId: string;
  name: string;
  cost: number;
  power: number;
  ability: string;
  art: string;
  series: string;
  tags: string[];
  deckable: boolean;
}

// Keep only the <span> markers Snap Zone uses for keywords like "On Reveal"; drop all other markup.
export function cleanAbility(html: string): string {
  return html
    .replace(/<(?!\/?span>)[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Released cards with no series are mostly alternate-mode versions ("Thor Champion",
 * "Hulk - Avengers") that can't go in a normal deck. A few real cards also lack a series,
 * so those are only excluded when their name looks like an alternate version.
 */
// Event/mode cards Snap Zone lists as released that can't be put in a normal deck.
const NOT_DECKABLE = new Set(["Mephisto", "HellcowFracturedFrontier"]);

export function isDeckable(card: Pick<SnapZoneCard, "name" | "status" | "source" | "carddefid">): boolean {
  if (card.status !== "released" || NOT_DECKABLE.has(card.carddefid)) return false;
  if (card.source !== "None") return true;
  if (/champion|\s-\s|^random$/i.test(card.name)) return false;
  // Internal names that leaked through, e.g. "CaptainAmericaAvengers".
  if (!card.name.includes(" ") && /^[A-Z][a-z]+[A-Z]\w*[A-Z]/.test(card.name)) return false;
  return true;
}

export function toRecord(c: SnapZoneCard): CardRecord {
  return {
    defId: c.carddefid,
    name: c.name,
    cost: c.cost,
    power: c.power,
    ability: cleanAbility(c.ability ?? ""),
    art: c.art,
    series: c.source && c.source !== "None" ? c.source : "Other",
    tags: (c.tags ?? []).map((t) => t.tag).filter(Boolean),
    deckable: isDeckable(c),
  };
}
