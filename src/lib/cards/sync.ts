import { getDb } from "@/lib/db";

const SOURCE = "https://marvelsnapzone.com/getinfo/?searchtype=cards&searchcardstype=true";

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

export async function syncCards(): Promise<{ total: number; deckable: number }> {
  const res = await fetch(SOURCE, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SnapHub fan deck builder)" },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Card source returned ${res.status}`);
  const body = (await res.json()) as { success?: { cards?: SnapZoneCard[] } };
  const raw = body.success?.cards;
  if (!Array.isArray(raw) || raw.length < 100) throw new Error("Card source returned no cards");

  const records = raw
    .filter((c) => c.type === "Character" && c.status === "released" && /^\w+$/.test(c.carddefid))
    .map(toRecord);

  const db = await getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.query(
      `insert into cards (def_id, name, cost, power, ability, art, series, tags, deckable, updated_at)
       select u.d, u.n, u.c, u.p, u.a, u.art, u.s, coalesce(array(select jsonb_array_elements_text(u.t)), '{}'),
              u.k, $10
         from unnest($1::text[], $2::text[], $3::int[], $4::int[], $5::text[], $6::text[], $7::text[],
                     $8::jsonb[], $9::bool[]) as u(d, n, c, p, a, art, s, t, k)
       on conflict (def_id) do update set
         name = excluded.name, cost = excluded.cost, power = excluded.power, ability = excluded.ability,
         art = excluded.art, series = excluded.series, tags = excluded.tags, deckable = excluded.deckable,
         updated_at = excluded.updated_at`,
      [
        records.map((r) => r.defId),
        records.map((r) => r.name),
        records.map((r) => r.cost),
        records.map((r) => r.power),
        records.map((r) => r.ability),
        records.map((r) => r.art),
        records.map((r) => r.series),
        records.map((r) => JSON.stringify(r.tags)),
        records.map((r) => r.deckable),
        now,
      ],
    );
    await tx.query(
      `insert into meta (key, value, updated_at) values ('cards_synced', $1, $2)
       on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
      [JSON.stringify({ at: now.toISOString(), total: records.length }), now],
    );
  });

  return { total: records.length, deckable: records.filter((r) => r.deckable).length };
}

export async function cardsSyncedAt(): Promise<Date | null> {
  const db = await getDb();
  const [row] = await db.query<{ updated_at: Date }>(`select updated_at from meta where key = 'cards_synced'`);
  return row?.updated_at ?? null;
}
