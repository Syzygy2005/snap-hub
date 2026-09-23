import { getDb } from "@/lib/db";
import { likePattern } from "@/lib/decks/queries";
import { clampPage, cleanQuery, value, type Filters } from "./filter";
import type { CardVariant } from "./variants";

export interface VariantEntry { card_id: string; card_name: string; variant: CardVariant }
/**
 * A card's variants as rows, guarding a column that is null or not an array on rows imported
 * before variants were read. Every variant query uses this one expression, the collection's
 * included, so the guard cannot be fixed in one query and left behind in another.
 */
export const VARIANT_ROWS = `jsonb_array_elements(case when jsonb_typeof(c.variants)='array' then c.variants else '[]'::jsonb end)`;
// Use the canonical imported catalog. No second feed or duplicated variant table.
const FROM = `from cards c cross join lateral ${VARIANT_ROWS} v where c.reference_status='released'`;

/**
 * `count: false` skips the total, for callers such as site search that only take the first few
 * rows and never show a page count. The total is a second full pass over the catalog.
 */
export async function browseVariants(sp: Filters, pageSize = 36, { count = true }: { count?: boolean } = {}) {
  const db = await getDb();
  const q = cleanQuery(value(sp, "q")).toLowerCase();
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
  const order = value(sp, "sort") === "newest" ? `(v->>'releaseDate') desc nulls last,` : "";
  const select = `select c.def_id as card_id,c.name as card_name,v as variant ${where}
    order by ${order} lower(c.name),c.def_id,v->>'id' limit $7 offset $8`;
  if (!count) {
    const items = await db.query<VariantEntry>(select, [...args, pageSize, 0]);
    return { items, total: items.length, page: 1, pages: 1, status };
  }
  const [{ total }] = await db.query<{ total: number }>(`select count(*)::int as total ${where}`, args);
  const { page, pages } = clampPage(value(sp, "page"), total, pageSize);
  const items = await db.query<VariantEntry>(select, [...args, pageSize, (page - 1) * pageSize]);
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

export async function findVariant(card: string, id: string): Promise<VariantEntry | null> {
  const [row] = await (await getDb()).query<VariantEntry>(`select c.def_id as card_id,c.name as card_name,v as variant ${FROM} and c.def_id=$1 and v->>'id'=$2 limit 1`,[card,id]);
  return row ?? null;
}

export interface ArtistSummary { name: string; total: number; released: number; roles: string[]; art: string }
/**
 * Artists and their credit counts. Callers say what they need rather than taking the whole
 * catalog and trimming it: `name` fetches one artist exactly, `limit` caps the rows, and `seed`
 * orders them by a stable hash so a daily pick needs one row. The spotlight used to aggregate
 * every artist to show one, and site search aggregated all of them to show nine.
 */
export async function artists({ q = "", name, limit, seed }: { q?: string; name?: string; limit?: number; seed?: string } = {}): Promise<ArtistSummary[]> {
  // DISTINCT counts a piece once even when an artist has multiple roles.
  return (await getDb()).query<ArtistSummary>(`with credits as (
    select c.def_id,v->>'id' as variant_id,v->>'status' as status,v->>'art' as art,
      a->>'name' as name,a->>'role' as role
    from cards c cross join lateral ${VARIANT_ROWS} v
    cross join lateral jsonb_array_elements(v->'artists') a where c.reference_status='released'
  ) select name,count(distinct (def_id,variant_id))::int as total,
      count(distinct (def_id,variant_id)) filter(where status='released')::int as released,
      array_agg(distinct role order by role) as roles,
      (array_agg(art order by (status='released') desc,def_id,variant_id))[1] as art
    from credits where ($1::text is null or name=$1) and lower(name) like $2
    group by name
    order by case when $3::text is null then null else md5(name||$3::text) end, lower(name), name
    limit $4::int`,
    [name ?? null, likePattern(cleanQuery(q).toLowerCase()), seed ?? null, limit ?? null]);
}
