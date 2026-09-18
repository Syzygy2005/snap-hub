/**
 * The parts of game news that both the server and the browser need. Kept apart from
 * queries.ts so the admin form can import them without dragging the database client
 * into the browser bundle, the same way cards/types.ts is kept apart from the card sync.
 */

export const NEWS_KINDS = ["balance", "patch", "season", "other"] as const;
export type NewsKind = (typeof NEWS_KINDS)[number];

export const KIND_LABELS: Record<NewsKind, string> = {
  balance: "Balance update",
  patch: "Patch",
  season: "New season",
  other: "News",
};

export const TITLE_MAX = 120;
export const BODY_MAX = 4000;

export interface NewsItem {
  id: number;
  kind: NewsKind;
  title: string;
  body: string;
  sourceUrl: string | null;
  publishedAt: string;
  author: string | null;
}

export function isKind(value: unknown): value is NewsKind {
  return typeof value === "string" && (NEWS_KINDS as readonly string[]).includes(value);
}

/**
 * An admin pasting a link is trusted to be careful, not trusted to be infallible. Anything
 * that is not plainly http or https never reaches an href, so a `javascript:` paste is a
 * rejected form rather than a live link on the page.
 */
export function cleanSourceUrl(value: unknown): { ok: true; url: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") return { ok: true, url: null };
  if (typeof value !== "string") return { ok: false, error: "Link must be text." };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, url: null };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Link must be a full address, starting with https://" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Link must be a full address, starting with https://" };
  }
  return { ok: true, url: parsed.toString() };
}
