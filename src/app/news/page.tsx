import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/ui";
import { NewsAdmin } from "@/components/news-admin";
import { isAdmin } from "@/lib/auth/admin";
import { currentAccount } from "@/lib/auth/session";
import { KIND_LABELS, listNews, type NewsItem } from "@/lib/news/queries";

export const metadata: Metadata = {
  title: "Game news",
  description: "Balance updates and patches for MARVEL SNAP.",
};

// Shows admin controls to an admin, so it can never be prerendered.
export const dynamic = "force-dynamic";

/** Fixed to UTC so a balance update reads the same date wherever it is opened. */
function newsDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function NewsPage() {
  const [items, account] = await Promise.all([listNews(), currentAccount()]);
  const admin = isAdmin(account);

  return (
    <>
      <PageHeader title="Game news" subtitle="Balance updates and patches, newest first.">
        {admin && <NewsAdmin />}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState title="Nothing yet">
          Balance updates and patches will show up here. For changes to this site, see{" "}
          <a href="/changelog" className="text-accent hover:underline">
            what&rsquo;s new
          </a>
          .
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} admin={admin} />
          ))}
        </div>
      )}
    </>
  );
}

export function NewsCard({ item, admin = false }: { item: NewsItem; admin?: boolean }) {
  return (
    <article className="rounded-xl border border-line bg-surface/80 px-4 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
          {KIND_LABELS[item.kind]}
        </span>
        <time dateTime={item.publishedAt} className="text-xs text-faint">
          {newsDate(item.publishedAt)}
        </time>
      </div>

      <h2 className="mt-2 font-display text-lg font-bold">{item.title}</h2>
      {/* Stored and rendered as text. Nothing here is ever treated as markup. */}
      <p className="mt-1 whitespace-pre-line text-sm text-muted">{item.body}</p>

      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-accent hover:underline"
        >
          Read the official post
        </a>
      )}

      {admin && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <NewsAdmin editing={item} />
        </div>
      )}
    </article>
  );
}
