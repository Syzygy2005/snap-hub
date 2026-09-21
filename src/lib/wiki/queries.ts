import type { CardVariant } from "./variants";
import { getDb } from "@/lib/db";
import type { Kind } from "./sync";
export interface Entry { def_id: string; name: string; ability: string; art: string; status: string; cost: number | null; power: number | null; series: string; tags: string[]; deckable: boolean; rarity: string }
export async function entries(kind: Kind): Promise<Entry[]> {
  const db = await getDb();
  return db.query<Entry>(kind === "cards"
    ? `select def_id,name,ability,art,reference_status as status,cost,power,series,tags,deckable,'' as rarity from cards order by name`
    : `select def_id,name,ability,art,status,null::int as cost,null::int as power,'' as series,'{}'::text[] as tags,false as deckable,rarity from locations order by name`);
}
export async function syncState(kind: Kind) {
  const db = await getDb();
  const [row] = await db.query<{ attempted_at: Date | null; succeeded_at: Date | null; changed_at: Date | null; error: string | null }>(`select * from reference_sync where kind=$1`, [kind]);
  return row ? { ...row, stale: !row.succeeded_at || Date.now() - row.succeeded_at.getTime() > 3*60*60*1000 } : null;
}
export async function history(kind: Kind, id: string) {
  const db = await getDb();
  return db.query<{ id: number; before_data: Record<string,string | number>; after_data: Record<string,string | number>; detected_at: Date }>(
    `select id,before_data,after_data,detected_at from reference_changes where kind=$1 and def_id=$2 order by detected_at desc, id desc`, [kind,id]);
}

export async function cardVariants(id: string): Promise<CardVariant[] | null> {
  const db = await getDb();
  const [row] = await db.query<{ variants: CardVariant[] | null }>(
    "select variants from cards where def_id=$1 and reference_status='released'", [id]);
  return row?.variants ?? null;
}
