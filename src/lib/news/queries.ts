import { getDb } from "@/lib/db";
import { BODY_MAX, cleanSourceUrl, isKind, TITLE_MAX, type NewsItem, type NewsKind } from "./types";

/**
 * Game news: balance updates and patches, as opposed to src/lib/changelog.ts, which is
 * changes to this site. Written by an admin rather than fetched, and stored rather than
 * committed, so posting one does not need a deploy.
 *
 * Items are a short summary in the poster's own words plus a link to the official post.
 * Reproducing Second Dinner's notes in full would be someone else's writing republished
 * wholesale, and the link is what a reader wants from it anyway.
 */

export * from "./types";

interface NewsRow {
  id: number;
  kind: string;
  title: string;
  body: string;
  source_url: string | null;
  published_at: Date;
  author: string | null;
}

const COLUMNS = `n.id, n.kind, n.title, n.body, n.source_url, n.published_at, a.username as author`;
const FROM = `from news n left join accounts a on a.id = n.author_id`;

const toItem = (r: NewsRow): NewsItem => ({
  id: r.id,
  kind: isKind(r.kind) ? r.kind : "other",
  title: r.title,
  body: r.body,
  sourceUrl: r.source_url,
  publishedAt: r.published_at.toISOString(),
  author: r.author,
});

export interface NewsInput {
  kind?: unknown;
  title?: unknown;
  body?: unknown;
  sourceUrl?: unknown;
  publishedAt?: unknown;
}

type Validated = { kind: NewsKind; title: string; body: string; sourceUrl: string | null; publishedAt: Date };
export type NewsResult = { ok: true; item: NewsItem } | { ok: false; error: string };

function validate(input: NewsInput): { ok: true; value: Validated } | { ok: false; error: string } {
  if (!isKind(input.kind)) return { ok: false, error: "Pick what kind of news this is." };
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false, error: "Give it a title." };
  if (title.length > TITLE_MAX) return { ok: false, error: `Title must be ${TITLE_MAX} characters or fewer.` };
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body) return { ok: false, error: "Say what changed." };
  if (body.length > BODY_MAX) return { ok: false, error: `Body must be ${BODY_MAX} characters or fewer.` };

  const link = cleanSourceUrl(input.sourceUrl);
  if (!link.ok) return link;

  // An empty date means now, so posting something the moment it lands needs no typing.
  const raw = typeof input.publishedAt === "string" ? input.publishedAt.trim() : "";
  const publishedAt = raw ? new Date(raw) : new Date();
  if (Number.isNaN(publishedAt.getTime())) return { ok: false, error: "That date did not make sense." };

  return { ok: true, value: { kind: input.kind, title, body, sourceUrl: link.url, publishedAt } };
}

export async function listNews(limit = 50): Promise<NewsItem[]> {
  const db = await getDb();
  const rows = await db.query<NewsRow>(
    `select ${COLUMNS} ${FROM} order by n.published_at desc, n.id desc limit $1`,
    [limit],
  );
  return rows.map(toItem);
}

export async function latestNews(): Promise<NewsItem | null> {
  const [item] = await listNews(1);
  return item ?? null;
}

export async function createNews(input: NewsInput, authorId: number | null): Promise<NewsResult> {
  const checked = validate(input);
  if (!checked.ok) return checked;
  const { kind, title, body, sourceUrl, publishedAt } = checked.value;
  const db = await getDb();
  const [row] = await db.query<{ id: number }>(
    `insert into news (kind, title, body, source_url, published_at, author_id)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [kind, title, body, sourceUrl, publishedAt, authorId],
  );
  const [created] = await db.query<NewsRow>(`select ${COLUMNS} ${FROM} where n.id = $1`, [row.id]);
  return { ok: true, item: toItem(created) };
}

export async function updateNews(id: number, input: NewsInput): Promise<NewsResult | null> {
  const checked = validate(input);
  if (!checked.ok) return checked;
  const { kind, title, body, sourceUrl, publishedAt } = checked.value;
  const db = await getDb();
  const rows = await db.query<{ id: number }>(
    `update news set kind = $2, title = $3, body = $4, source_url = $5, published_at = $6, updated_at = now()
      where id = $1 returning id`,
    [id, kind, title, body, sourceUrl, publishedAt],
  );
  if (!rows.length) return null;
  const [updated] = await db.query<NewsRow>(`select ${COLUMNS} ${FROM} where n.id = $1`, [id]);
  return { ok: true, item: toItem(updated) };
}

export async function deleteNews(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query<{ id: number }>(`delete from news where id = $1 returning id`, [id]);
  return rows.length > 0;
}
