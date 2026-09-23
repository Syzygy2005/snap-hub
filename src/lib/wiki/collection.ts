import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { findVariant, VARIANT_ROWS, type VariantEntry } from "./variant-browser";

export type VariantStatus = "owned" | "wanted";
export interface SavedVariant { card_id: string; variant_id: string; status: VariantStatus }
export interface CollectionEntry extends SavedVariant { card_name: string; variant: VariantEntry["variant"] | null }

export async function savedVariants(owner: number): Promise<SavedVariant[]> {
  return (await getDb()).query<SavedVariant>("select card_id,variant_id,status from account_variants where owner_id=$1", [owner]);
}

export async function setVariant(owner: number, card: string, id: string, status: VariantStatus | null) {
  const db = await getDb();
  // Removing remains possible if an item disappears from the upstream catalog.
  if (status === null) {
    await db.query("delete from account_variants where owner_id=$1 and card_id=$2 and variant_id=$3", [owner,card,id]);
    return;
  }
  const item = await findVariant(card,id);
  if (!item || (status === "owned" && item.variant.status !== "released")) throw new Error("Choose a listed variant; previews can only be wanted.");
  await db.query(`insert into account_variants(owner_id,card_id,variant_id,status) values($1,$2,$3,$4)
    on conflict(owner_id,card_id,variant_id) do update set status=excluded.status,updated_at=now()`, [owner,card,id,status]);
}

export async function collection(owner: number, status?: VariantStatus): Promise<CollectionEntry[]> {
  return (await getDb()).query<CollectionEntry>(`select s.card_id,s.variant_id,s.status,coalesce(c.name,s.card_id) as card_name,v as variant
    from account_variants s left join cards c on c.def_id=s.card_id and c.reference_status='released'
    left join lateral ${VARIANT_ROWS} v
      on v->>'id'=s.variant_id
    where s.owner_id=$1 and ($2::text is null or s.status=$2) order by lower(coalesce(c.name,s.card_id)),s.variant_id`, [owner,status ?? null]);
}

export async function shareToken(owner: number): Promise<string | null> {
  const [row] = await (await getDb()).query<{token:string}>("select token from wishlist_shares where owner_id=$1",[owner]);
  return row?.token ?? null;
}
export async function enableShare(owner: number): Promise<string> {
  const [row] = await (await getDb()).query<{token:string}>(`insert into wishlist_shares(owner_id,token) values($1,$2)
    on conflict(owner_id) do update set owner_id=excluded.owner_id returning token`,[owner,randomBytes(24).toString("base64url")]);
  return row.token;
}
export async function disableShare(owner: number) {
  await (await getDb()).query("delete from wishlist_shares where owner_id=$1",[owner]);
}
export async function sharedWishlist(token: string) {
  if (!/^[\w-]{32}$/.test(token)) return null;
  const [row] = await (await getDb()).query<{owner_id:number;username:string}>(`select s.owner_id,a.username
    from wishlist_shares s join accounts a on a.id=s.owner_id where s.token=$1`,[token]);
  if (!row) return null;
  return { username:row.username,items:await collection(row.owner_id,"wanted") };
}
