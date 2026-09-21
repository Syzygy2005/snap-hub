import { parse, type DefaultTreeAdapterTypes } from "parse5";
type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
export interface HistoricalCard { date: string | null; label: string; cost: number; power: number; description: string }
const children = (n: Node): Node[] => "childNodes" in n ? n.childNodes : [];
const text = (n: Node): string => {
  if ("tagName" in n && ["script","style"].includes(n.tagName)) return "";
  return "value" in n ? n.value : children(n).map(text).join(" ");
};
const clean = (n: Node) => text(n).replace(/\s+/g, " ").trim();
function elements(node: Node, tag: string): Element[] {
  return children(node).flatMap(n => [...("tagName" in n && n.tagName === tag ? [n] : []), ...elements(n,tag)]);
}
/** Accept only the documented History table; never render source HTML or infer missing dates. */
export function parseCardHistory(html: string): HistoricalCard[] {
  if (html.length > 2_000_000) throw new Error("History page too large");
  const doc = parse(html);
  const section = elements(doc, "section").find(s => elements(s,"h2").some(h => clean(h) === "History"));
  if (!section) throw new Error("History section unavailable");
  const table = elements(section,"table")[0];
  if (!table || elements(table,"th").map(clean).join("|") !== "Date|Cost|Power|Description") throw new Error("History format changed");
  const body = elements(table,"tbody")[0];
  if (!body) throw new Error("History rows unavailable");
  const rows = elements(body,"tr");
  if (!rows.length || rows.length > 250) throw new Error("Unexpected history length");
  return rows.map(row => {
    const cells = elements(row,"td").map(clean);
    if (cells.length !== 4) throw new Error("Invalid history row");
    const [label,costText,powerText,description] = cells;
    const date = label.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? null;
    if (date && (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date)) throw new Error("Invalid history date");
    if (!date && !/released|unknown|—/i.test(label)) throw new Error("Missing history date");
    const number = (value: string) => {
      const cleaned = value.replace(/[▲▼+]/g,"").trim();
      if (!/^-?\d+$/.test(cleaned)) throw new Error("Invalid historical stat");
      return Number(cleaned);
    };
    if (description.length > 2500) throw new Error("Invalid history description");
    return {date,label,cost:number(costText),power:number(powerText),description};
  });
}
export async function cardHistory(id: string) {
  if (!/^\w+$/.test(id)) return { rows: null, url: "https://snap.fan/cards/" };
  const url = `https://snap.fan/cards/${encodeURIComponent(id)}/`;
  try {
    const response = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "SnapHub reference history (+https://snap-hub.app/credits)" },
    });
    if (!response.ok) return {rows:null,url};
    return {rows:parseCardHistory(await response.text()),url};
  } catch { return {rows:null,url}; }
}
