export interface CardVariant {
  /** Stable Marvel Snap Zone variant ID, not a game card identifier. */
  id: string;
  art: string;
  order: string | null;
  status: "released" | "unreleased";
  /** The provider combines rarity and acquisition categories in this field. */
  rarity: string | null;
  artists: { role: "Sketch" | "Ink" | "Color"; name: string }[];
  /** Provider date only: status can disagree with future dates. */
  releaseDate: string | null;
  collectorQuality: string | null;
}

function optionalText(value: unknown, limit: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > limit || /[<>\u0000-\u001f]/.test(value))
    throw new Error("Invalid variant metadata");
  return value.trim() || null;
}

function sourceDate(value: unknown): string | null {
  if (value == null || value === "" || value === 0 || value === "0") return null;
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value)))
    throw new Error("Invalid variant release date");
  const seconds = Number(value);
  // The feed uses the signed 32-bit maximum as an unknown-date sentinel.
  if (seconds === 2147483647) return null;
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 4102444800)
    throw new Error("Invalid variant release date");
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function artUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 1000) throw new Error("Invalid variant artwork");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid variant artwork"); }
  if (url.protocol !== "https:" || url.hostname !== "marvelsnapzone.com" || url.port ||
    url.username || url.password || url.hash ||
    !url.pathname.startsWith("/wp-content/themes/blocksy-child/assets/media/cards/"))
    throw new Error("Invalid variant artwork");
  return url.href;
}

/** Parse nested feed records. Never guess category names from an artist or image filename. */
export function parseVariants(raw: unknown, parentCid?: number): CardVariant[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 500) throw new Error("Invalid variant list");
  if (parentCid !== undefined && (!Number.isSafeInteger(parentCid) || parentCid <= 0))
    throw new Error("Invalid variant parent");
  const variants = new Map<string, CardVariant>();
  for (const value of raw) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid variant record");
    const r = value as Record<string, unknown>;
    if (!Number.isSafeInteger(r.vid) || Number(r.vid) <= 0 || !Number.isSafeInteger(r.cid) ||
      Number(r.cid) <= 0 || (parentCid !== undefined && r.cid !== parentCid))
      throw new Error("Invalid variant identity");
    const status = typeof r.status === "string" ? r.status.toLowerCase() : "";
    if (status !== "released" && status !== "unreleased") throw new Error("Invalid variant status");
    const order = optionalText(r.variant_order, 32);
    if (order && !/^\w+$/.test(order)) throw new Error("Invalid variant order");
    const artists: CardVariant["artists"] = [];
    for (const [key, role] of [["sketcher", "Sketch"], ["inker", "Ink"], ["colorist", "Color"]] as const) {
      const name = optionalText(r[key], 160);
      if (name) artists.push({ role, name });
    }
    const variant: CardVariant = {
      id: String(r.vid), art: artUrl(r.art), order, status,
      rarity: optionalText(r.rarity, 80), artists, releaseDate: sourceDate(r.ReleaseDate),
      collectorQuality: optionalText(r.CollectorsQualityDefId, 80),
    };
    const previous = variants.get(variant.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(variant))
      throw new Error("Conflicting variant IDs");
    variants.set(variant.id, variant);
  }
  return [...variants.values()];
}
