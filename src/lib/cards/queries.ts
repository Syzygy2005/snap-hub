import { getDb } from "@/lib/db";
import type { Card } from "./types";

export async function getCards(opts: { deckableOnly?: boolean } = {}): Promise<Card[]> {
  const db = await getDb();
  const rows = await db.query<{
    def_id: string;
    name: string;
    cost: number;
    power: number;
    ability: string;
    art: string;
    series: string;
    tags: string[];
    deckable: boolean;
  }>(
    `select def_id, name, cost, power, ability, art, series, tags, deckable
       from cards ${opts.deckableOnly ? "where deckable and reference_status = 'released'" : ""}
      order by cost, name`,
  );
  return rows.map((r) => ({
    defId: r.def_id,
    name: r.name,
    cost: r.cost,
    power: r.power,
    ability: r.ability,
    art: r.art,
    series: r.series,
    tags: r.tags ?? [],
    deckable: r.deckable,
  }));
}
