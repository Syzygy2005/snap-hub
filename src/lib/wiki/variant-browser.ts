import { getDb } from "@/lib/db";
import { likePattern } from "@/lib/decks/queries";
import { value, type Filters } from "./filter";
import type { CardVariant } from "./variants";

export interface VariantEntry { card_id: string; card_name: string; variant: CardVariant }
// Use the canonical imported catalog. No second feed or duplicated variant table.
const FROM = `from cards c cross join lateral jsonb_array_elements(
  case when jsonb_typeof(c.variants)='array' then c.variants else '[]'::jsonb end
) v where c.reference_status='released'`;

export async function browseVariants(sp: Filters, pageSize = 36) {
  const db = await getDb();
  const q = value(sp, "q").trim().slice(0, 100).toLowerCase();
  const status = value(sp, "status") === "unreleased" ? "unreleased" : "released";
  const artist = value(sp, "artist").slice(0, 160);
  const rarity = value(sp, "rarity").slice(0, 80);
  const card = value(sp, "card").slice(0, 160);
  const where = `${FROM} and v->>'status'=$1
    and ($2='' or lower(concat_ws(' ',c.name,v->>'id',v->>'rarity',
      (select string_agg(a->>'name',' ') from jsonb_array_elements(v->'artists') a))) like $3)
    and ($4='' or exists(select 1 from jsonb_array_elements(v->'artists') a where lower(a->>'name')=lower($4)))
    and ($5='' or v->>'rarity'=$5) and ($6='' or c.def_id=$6)`;
  const args = [status, q, likePattern(q), artist, rarity, card];
  const [count] = await db.query<{ total: number }>(`select count(*)::int as total ${where}`, args);
  const total = count.total;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number(value(sp, "page"));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1));
  const order = value(sp, "sort") === "newest" ? `(v->>'releaseDate') desc nulls last,` : "";
  const items = await db.query<VariantEntry>(`select c.def_id as card_id,c.name as card_name,v as variant ${where}
    order by ${order} lower(c.name),c.def_id,v->>'id' limit $7 offset $8`, [...args, pageSize, (page-1)*pageSize]);
  return { items, total, page, pages, status };
}

export async function variantFacets(status: string) {
  const db = await getDb();
  const rows = await db.query<{ artists: string[]; rarity: string | null }>(
    `select array(select distinct a->>'name' from jsonb_array_elements(v->'artists') a) as artists,
      v->>'rarity' as rarity ${FROM} and v->>'status'=$1`, [status]);
  const unique = (values: string[]) => [...new Set(values)].sort((a,b) => a.localeCompare(b));
  return { artists: unique(rows.flatMap(r => r.artists)), rarities: unique(rows.flatMap(r => r.rarity ? [r.rarity] : [])) };
}

export function variantHref(card: string, id: string) {
  return `/wiki/cards/${encodeURIComponent(card)}#variant-${encodeURIComponent(id)}`;
}

export async function findVariant(card: string, id: string): Promise<VariantEntry | null> {
  const [row] = await (await getDb()).query<VariantEntry>(`select c.def_id as card_id,c.name as card_name,v as variant ${FROM} and c.def_id=$1 and v->>'id'=$2 limit 1`,[card,id]);
  return row ?? null;
}

export interface ArtistSummary { name: string; total: number; released: number; roles: string[]; art: string }
export async function artists(q = ""): Promise<ArtistSummary[]> {
  // DISTINCT counts a piece once even when an artist has multiple roles.
  return (await getDb()).query<ArtistSummary>(`with credits as (
    select c.def_id,v->>'id' as variant_id,v->>'status' as status,v->>'art' as art,
      a->>'name' as name,a->>'role' as role
    from cards c cross join lateral jsonb_array_elements(case when jsonb_typeof(c.variants)='array' then c.variants else '[]'::jsonb end) v
    cross join lateral jsonb_array_elements(v->'artists') a where c.reference_status='released'
  ) select name,count(distinct (def_id,variant_id))::int as total,
      count(distinct (def_id,variant_id)) filter(where status='released')::int as released,
      array_agg(distinct role order by role) as roles,
      (array_agg(art order by (status='released') desc,def_id,variant_id))[1] as art
    from credits where lower(name) like $1 group by name order by lower(name),name`,[likePattern(q.trim().slice(0,100).toLowerCase())]);
}
