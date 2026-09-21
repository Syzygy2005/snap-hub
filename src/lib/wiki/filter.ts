import type { Entry } from "./queries";
export type Filters = Record<string, string | string[] | undefined>;
export const value = (sp: Filters, key: string) => typeof sp[key] === "string" ? sp[key] as string : "";
export function filterEntries(items: Entry[], sp: Filters) {
  const q = value(sp,"q").trim().toLowerCase();
  const filtered = items.filter(e => e.status === "released" &&
    (!q || `${e.name} ${e.ability.replace(/<[^>]*>/g, "")}`.toLowerCase().includes(q)) &&
    (!["cost","power","series","rarity"].some(key => value(sp,key) && String(e[key as keyof Entry]) !== value(sp,key))) &&
    (!value(sp,"keyword") || e.ability.toLowerCase().includes(value(sp,"keyword").toLowerCase()) || e.tags.includes(value(sp,"keyword"))) &&
    (!value(sp,"category") || (value(sp,"category") === "deckable" ? e.deckable : !e.deckable)));
  const sort = value(sp,"sort");
  filtered.sort((a,b) => (sort === "cost" ? (a.cost ?? 0)-(b.cost ?? 0) : sort === "power" ? (b.power ?? 0)-(a.power ?? 0) : 0) || a.name.localeCompare(b.name));
  const pages = Math.max(1,Math.ceil(filtered.length / 36));
  const page = Math.min(pages,Math.max(1,Math.floor(Number(value(sp,"page"))) || 1));
  return { items: filtered.slice((page-1)*36,page*36), total: filtered.length, page, pages };
}
export function pageHref(path: string, sp: Filters, page: number) {
  const query = new URLSearchParams();
  for (const key of ["q","cost","power","series","rarity","keyword","category","sort"]) if (value(sp,key)) query.set(key,value(sp,key));
  query.set("page",String(page));
  return `${path}?${query}`;
}
