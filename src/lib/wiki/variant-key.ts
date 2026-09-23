export const variantKey = (card: string, variant: string) => JSON.stringify([card,variant]);
export function parseVariantKey(key: string): [string,string] | null {
  try {
    const value: unknown = JSON.parse(key);
    return Array.isArray(value) && value.length===2 && value.every(v=>typeof v==="string" && v.length>0 && v.length<=160) ? value as [string,string] : null;
  } catch { return null; }
}
export const artistHref = (name: string) => `/wiki/artists/${encodeURIComponent(name)}`;
export const variantHref = (card: string, id: string) =>
  `/wiki/cards/${encodeURIComponent(card)}#variant-${encodeURIComponent(id)}`;
