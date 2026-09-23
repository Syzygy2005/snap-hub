import type { Entry } from "./queries";
export type Filters = Record<string, string | string[] | undefined>;
export const value = (sp: Filters, key: string) => typeof sp[key] === "string" ? sp[key] as string : "";
/** A search box's text, trimmed and capped. Every search reads it this way. */
export const cleanQuery = (q: string) => q.trim().slice(0, 100);
/** Card ability text carries <span>Keyword</span> markers; this is the plain reading of it. */
export const stripTags = (s: string) => s.replace(/<[^>]*>/g, "");
/**
 * The page asked for in the query string, clamped to the pages that exist. Five pages each had
 * their own copy of this and they had already started to differ.
 */
export function clampPage(requested: string, total: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const n = Math.floor(Number(requested));
  return { page: Math.min(pages, Math.max(1, Number.isFinite(n) ? n : 1)), pages };
}
export function filterEntries(items: Entry[], sp: Filters) {
  const q = cleanQuery(value(sp,"q")).toLowerCase();
  const filtered = items.filter(e => e.status === "released" &&
    (!q || `${e.name} ${stripTags(e.ability)}`.toLowerCase().includes(q)) &&
    (!["cost","power","series","rarity"].some(key => value(sp,key) && String(e[key as keyof Entry]) !== value(sp,key))) &&
    (!value(sp,"keyword") || e.ability.toLowerCase().includes(value(sp,"keyword").toLowerCase()) || e.tags.includes(value(sp,"keyword"))) &&
    (!value(sp,"category") || (value(sp,"category") === "deckable" ? e.deckable : !e.deckable)));
  const sort = value(sp,"sort");
  filtered.sort((a,b) => (sort === "cost" ? (a.cost ?? 0)-(b.cost ?? 0) : sort === "power" ? (b.power ?? 0)-(a.power ?? 0) : 0) || a.name.localeCompare(b.name));
  const { page, pages } = clampPage(value(sp,"page"), filtered.length, 36);
  return { items: filtered.slice((page-1)*36,page*36), total: filtered.length, page, pages };
}
export function pageHref(path: string, sp: Filters, page: number) {
  const query = new URLSearchParams();
  for (const key of ["q","cost","power","series","rarity","keyword","category","sort","artist","status","card"]) if (value(sp,key)) query.set(key,value(sp,key));
  query.set("page",String(page));
  return `${path}?${query}`;
}
