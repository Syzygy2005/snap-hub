import { parse, type DefaultTreeAdapterTypes } from "parse5";

type Node = DefaultTreeAdapterTypes.Node;
export interface LocationRate {
  games: number;
  totalGames: number;
  percent: number;
  url: string;
}

const SOURCE = "https://www.snapvault.app/locations";
const MAX_BYTES = 2_000_000;
const validId = (id: string) => /^[A-Za-z0-9_]{1,100}$/.test(id);
const children = (node: Node): Node[] => "childNodes" in node ? node.childNodes : [];
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Read only the public page's JSON data frames; source JavaScript is never executed. */
export function parseLocationRate(html: string, id: string): LocationRate | null {
  if (!validId(id) || html.length > MAX_BYTES) return null;
  try {
    const nodes: Node[] = [parse(html)];
    const paragraphs: string[] = [];
    let frames = "";
    const text = (node: Node): string => {
      if ("tagName" in node && ["script", "style"].includes(node.tagName)) return "";
      return "value" in node ? node.value : children(node).map(text).join(" ");
    };
    while (nodes.length) {
      const node = nodes.pop()!;
      if ("tagName" in node && node.tagName === "p") paragraphs.push(text(node).replace(/\s+/g, " ").trim());
      if ("tagName" in node && node.tagName === "script") {
        const script = children(node).map(child => "value" in child ? child.value : "").join("");
        const match = script.match(/^self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?$/);
        if (match) {
          let chunk: unknown;
          try { chunk = JSON.parse(match[1]); } catch { continue; }
          if (Array.isArray(chunk) && chunk[0] === 1 && typeof chunk[1] === "string") frames += chunk[1];
        }
      } else {
        // A stack visits children in document order so split data frames stay ordered.
        nodes.push(...children(node).slice().reverse());
      }
    }

    // The field names alone are not enough to establish the sample window or modes.
    const sampleLabels = paragraphs.flatMap(paragraph => {
      const match = paragraph.match(/Play rates come from ([\d,]+) tracked ranked and Conquest games over the last 30 days\./);
      return match ? [Number(match[1].replaceAll(",", ""))] : [];
    });
    if (!sampleLabels.length || sampleLabels.some(total => !Number.isSafeInteger(total) || total <= 0)) return null;

    let found: LocationRate | null = null;
    for (const frame of frames.split("\n")) {
      const match = frame.match(/^[\da-f]+:(\[[\s\S]*\])$/);
      if (!match || !frame.includes('"games30d"')) continue;
      let payload: unknown;
      // A frame that will not parse is a frame, not a verdict on the page: the script-level
      // parse above skips the same way. Returning null here dropped the appearance rate for
      // every location because one row reassembled badly.
      try { payload = JSON.parse(match[1]); } catch { continue; }
      if (!Array.isArray(payload) || payload[0] !== "$" || !object(payload[3])) continue;
      const data = payload[3].data;
      if (!object(data) || !Array.isArray(data.locations)) continue;
      const total = data.totalGames30d;
      if (typeof total !== "number" || !Number.isSafeInteger(total) || total <= 0 || sampleLabels.some(label => label !== total)) return null;
      if (!data.locations.length || data.locations.length > 1000) return null;
      const ids = new Set<string>();
      for (const row of data.locations) {
        if (!object(row) || typeof row.id !== "string" || !validId(row.id) || ids.has(row.id)) return null;
        ids.add(row.id);
        if (typeof row.games30d !== "number" || !Number.isSafeInteger(row.games30d) || row.games30d < 0 || row.games30d > total) return null;
        if (row.id !== id) continue;
        if (found) return null;
        found = { games: row.games30d, totalGames: total, percent: row.games30d / total * 100, url: `${SOURCE}/${encodeURIComponent(id)}` };
      }
    }
    return found;
  } catch {
    return null;
  }
}

async function boundedHtml(response: Response): Promise<string | null> {
  if (!response.body) return null;
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES) {
    await response.body.cancel();
    return null;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return html + decoder.decode();
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

/** Optional empirical match presence, never the game's natural location spawn probability. */
export async function locationRate(id: string): Promise<LocationRate | null> {
  if (!validId(id)) return null;
  try {
    const response = await fetch(SOURCE, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "SnapHub location reference (+https://snap-hub.app/credits)" },
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return null;
    const html = await boundedHtml(response);
    return html === null ? null : parseLocationRate(html, id);
  } catch {
    return null;
  }
}
