import { parseVariants, type CardVariant } from "./variants";
import { getDb } from "@/lib/db";
import { cleanAbility, toRecord } from "@/lib/cards/sync";

export type Kind = "cards" | "locations";
export const sourceUrl = (kind: Kind) => `https://marvelsnapzone.com/getinfo/?searchtype=${kind}&searchcardstype=true`;
type Imported = { def_id: string; name: string; ability: string; art: string; status: string; rarity: string; cost: number; power: number; series: string; tags: string[]; deckable: boolean; variants: CardVariant[] };

// JSONB normalizes object-key order; cosmetic data should compare by value.
const stableValue = (value: unknown) => JSON.stringify(value, (_key, item) =>
  item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);

/** Validate the complete envelope before touching live reference data. */
export function parseReference(body: unknown, kind: Kind): Imported[] {
  const raw = (body as { success?: { cards?: unknown } } | null)?.success?.cards;
  if (!Array.isArray(raw) || raw.length < (kind === "cards" ? 100 : 50)) throw new Error("Reference feed is empty or incomplete");
  const ids = new Set<string>();
  return raw.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid reference record");
    const r = { ...value } as Record<string, unknown>;
    // Some source locations have no game ID (e.g. Mother Mold). Preserve their stable
    // provider ID without guessing a game identifier or joining them to match history.
    if (kind === "locations" && r.carddefid === "" && Number.isSafeInteger(r.cid) && Number(r.cid) > 0)
      r.carddefid = `SnapZoneLocation_${r.cid}`;
    if (r.type !== (kind === "cards" ? "Character" : "Location") ||
      typeof r.carddefid !== "string" || !/^\w+$/.test(r.carddefid) || ids.has(r.carddefid) ||
      typeof r.name !== "string" || !r.name.trim() || typeof r.ability !== "string" ||
      typeof r.art !== "string" || (r.art !== "" && !/^https:\/\//.test(r.art)) ||
      !["released", "unreleased"].includes(String(r.status))) throw new Error("Invalid or duplicate reference record");
    ids.add(r.carddefid);
    if (kind === "cards" && (!Number.isSafeInteger(r.cost) || !Number.isSafeInteger(r.power) ||
      typeof r.source !== "string" || !Array.isArray(r.tags) || r.tags.some(t => !t || typeof t.tag !== "string"))) throw new Error("Invalid card stats or tags");
    if (kind === "locations" && r.rarity !== undefined && typeof r.rarity !== "string") throw new Error("Invalid location rarity");
    if (kind === "cards" && !Array.isArray(r.variants)) throw new Error("Invalid variant list");
    if (kind === "cards" && (r.variants as unknown[]).length && !Number.isSafeInteger(r.cid)) throw new Error("Invalid variant parent");
    const card = kind === "cards" ? toRecord(r as unknown as Parameters<typeof toRecord>[0]) : null;
    return { def_id: r.carddefid, name: r.name, ability: cleanAbility(r.ability), art: r.art,
      status: String(r.status), rarity: String(r.rarity || "unknown"), cost: card?.cost ?? 0, power: card?.power ?? 0,
      series: card?.series ?? "", tags: card?.tags ?? [], deckable: card?.deckable ?? false,
      variants: kind === "cards" ? parseVariants(r.variants, typeof r.cid === "number" ? r.cid : undefined) : [] };
  });
}

async function download(kind: Kind, modified?: string | null) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(sourceUrl(kind), { cache: "no-store", signal: AbortSignal.timeout(15_000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SnapHub reference sync)", ...(modified ? { "If-Modified-Since": modified } : {}) } });
      if (response.status === 304 || response.ok) return response;
      if (attempt === 0 && response.status >= 500) continue;
      throw new Error(`Reference source returned HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 0 && error instanceof Error && ["TimeoutError", "TypeError"].includes(error.name)) continue;
      throw error;
    }
  }
}

export async function syncReference(kind: Kind): Promise<{ total: number; deckable: number }> {
  const db = await getDb();
  await db.query(`insert into reference_sync(kind, attempted_at) values ($1, now())
    on conflict(kind) do update set attempted_at = now()`, [kind]);
  try {
    const [state] = await db.query<{ last_modified: string | null; succeeded_at: Date | null; ids: string[] }>(`select * from reference_sync where kind = $1`, [kind]);
    // An existing successful import may predate variants. Force one full response to backfill it.
    const needsVariants = kind === "cards" && (await db.query("select 1 from cards where variants is null limit 1")).length > 0;
    const response = await download(kind, state?.succeeded_at && !needsVariants ? state.last_modified : null);
    if (response.status === 304) {
      if (!state?.succeeded_at || !state.ids.length) throw new Error("Source returned no baseline data");
      await db.query(`update reference_sync set succeeded_at = now(), error = null where kind = $1`, [kind]);
      const [count] = await db.query<{ total: number; deckable: number }>(kind === "cards"
        ? `select count(*)::int as total, count(*) filter(where deckable)::int as deckable from cards where reference_status = 'released'`
        : `select count(*)::int as total, 0 as deckable from locations where status = 'released'`);
      return count;
    }
    const records = parseReference(await response.json(), kind);
    const ids = records.map(r => r.def_id);
    await db.transaction(async tx => {
      // Serialize imports and re-read the baseline: overlapping jobs cannot lose history.
      await tx.query(`select kind from reference_sync where kind = $1 for update`, [kind]);
      const [current] = await tx.query<{ ids: string[]; succeeded_at: Date | null }>(`select ids, succeeded_at from reference_sync where kind = $1`, [kind]);
      if (current.ids.some(id => !ids.includes(id))) throw new Error("Reference feed dropped known IDs; retained last good data");
      const table = kind === "cards" ? "cards" : "locations";
      const fields = kind === "cards" ? "name, cost, power, ability" : "name, ability";
      const old = await tx.query<{ def_id: string } & Record<string, unknown>>(`select * from ${table}`);
      const before = new Map(old.map(row => [row.def_id, row]));
      if (!current.succeeded_at && old.some(row => (row.reference_status ?? row.status) === "released" && !ids.includes(row.def_id)))
        throw new Error("Reference baseline omitted existing IDs; retained last good data");
      if (kind === "cards") {
        const previousVariants = old.reduce((total,row) => total + (Array.isArray(row.variants) ? row.variants.length : 0), 0);
        const importedVariants = records.reduce((total,row) => total + row.variants.length, 0);
        if (importedVariants < previousVariants * .8 || records.some(row => {
          const saved = before.get(row.def_id)?.variants;
          return Array.isArray(saved) && saved.length > 0 && row.variants.length === 0;
        })) throw new Error("Suspicious drop in variant catalog; retained last good data");
      }
      const released = records.filter(r => r.status === "released");
      const previousReleased = old.filter(row => (row.reference_status ?? row.status) === "released").length;
      if (released.length < previousReleased * .8) throw new Error("Suspicious drop in released entries; retained last good data");
      const tracked = fields.split(", ");
      const changes = records.flatMap(r => {
        const previous = before.get(r.def_id);
        if (!previous || !current.succeeded_at || !tracked.some(key => previous[key] !== r[key as keyof Imported])) return [];
        return [{ def_id: r.def_id, before_data: Object.fromEntries(tracked.map(key => [key, previous[key]])), after_data: Object.fromEntries(tracked.map(key => [key, r[key as keyof Imported]])) }];
      });
      await tx.query(`insert into reference_changes(kind, def_id, before_data, after_data)
        select $1, x.def_id, x.before_data, x.after_data from jsonb_to_recordset($2::text::jsonb) as x(def_id text, before_data jsonb, after_data jsonb)`, [kind, JSON.stringify(changes)]);
      // Send serialized JSON as text: postgres.js otherwise JSON-encodes the string again.
      const payload = JSON.stringify(records);
      if (kind === "cards") {
        await tx.query(`insert into cards(def_id, name, cost, power, ability, art, series, tags, deckable, reference_status, variants)
          select def_id, name, cost, power, ability, art, series, tags, deckable, status, variants
          from jsonb_to_recordset($1::text::jsonb) as x(def_id text, name text, cost int, power int, ability text, art text, series text, tags text[], deckable bool, status text, variants jsonb)
          on conflict(def_id) do update set name=excluded.name, cost=excluded.cost, power=excluded.power,
          ability=excluded.ability, art=excluded.art, series=excluded.series, tags=excluded.tags, deckable=excluded.deckable,
          reference_status=excluded.reference_status, variants=excluded.variants, updated_at=now()`, [payload]);
        await tx.query(`insert into meta(key,value,updated_at) values ('cards_synced',$1::text::jsonb,now())
          on conflict(key) do update set value=excluded.value, updated_at=now()`, [JSON.stringify({ total: records.length })]);
      } else {
        await tx.query(`insert into locations(def_id,name,ability,art,rarity,status)
          select def_id,name,ability,art,rarity,status from jsonb_to_recordset($1::text::jsonb) as x(def_id text,name text,ability text,art text,rarity text,status text)
          on conflict(def_id) do update set name=excluded.name, ability=excluded.ability, art=excluded.art,
          rarity=excluded.rarity, status=excluded.status, updated_at=now()`, [payload]);
      }
      const compared = kind === "cards" ? ["name","cost","power","ability","art","series","tags","deckable","variants"] : ["name","ability","art","rarity","status"];
      const changed = records.some(r => {
        const previous = before.get(r.def_id);
        return !previous || compared.some(key => stableValue(previous[key]) !== stableValue(r[key as keyof Imported])) ||
          (kind === "cards" && previous.reference_status !== r.status);
      });
      await tx.query(`update reference_sync set succeeded_at=now(), error=null, last_modified=$2, ids=$3::text[],
        changed_at=case when $4 then now() else changed_at end where kind=$1`, [kind, response.headers.get("last-modified"), released.map(r => r.def_id), changed]);
    });
    return { total: records.filter(r => r.status === "released").length, deckable: records.filter(r => r.deckable).length };
  } catch (error) {
    await db.query(`update reference_sync set error=$2 where kind=$1`, [kind, error instanceof Error ? error.message : "Reference sync failed"]);
    throw error;
  }
}
