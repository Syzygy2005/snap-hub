import Link from "next/link";
import { BrandGlyph } from "./brand";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-intro mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line/60 pb-6">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <div className="mt-2 text-sm text-muted">{subtitle}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
  tone = "surface",
  description,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "surface" | "quiet";
  description?: ReactNode;
}) {
  return (
    <section className={`brand-panel panel-${tone} rounded-xl ${className}`}>
      {(title || action) && (
        <div className="panel-heading flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          {title && <h2 className="font-display text-sm font-bold tracking-wide">{title}</h2>}
          {action}
        </div>
      )}
      {description && <div className="px-4 pb-3">{description}</div>}
      {children}
    </section>
  );
}

export function Tabs({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`rounded-md px-3 py-1 font-medium transition-colors ${
            t.active ? "bg-jade text-forest" : "text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/** Rank change: positive = climbed. undefined = not enough history yet. */
export function RankDelta({ past, now, isNew }: { past?: number | null; now: number; isNew?: boolean }) {
  if (isNew || past === null) {
    return <span className="rounded-sm bg-gem-blue/15 px-1.5 py-0.5 text-[11px] font-semibold text-gem-blue">NEW</span>;
  }
  if (past === undefined) return <span className="text-faint">—</span>;
  const d = past - now;
  if (d === 0) return <span className="text-faint">·</span>;
  return (
    <span className={`num inline-flex items-center gap-0.5 font-medium ${d > 0 ? "text-up" : "text-down"}`}>
      <svg viewBox="0 0 10 10" className={`h-2.5 w-2.5 ${d < 0 ? "rotate-180" : ""}`} aria-hidden>
        <path d="M5 1 9 7H1Z" fill="currentColor" />
      </svg>
      {Math.abs(d).toLocaleString()}
      <span className="sr-only">{d > 0 ? "places up" : "places down"}</span>
    </span>
  );
}

export function ScoreDelta({ past, now }: { past?: number | null; now: number }) {
  if (typeof past !== "number") return <span className="text-faint">—</span>;
  const d = now - past;
  if (d === 0) return <span className="text-faint">·</span>;
  return (
    <span className={`num ${d > 0 ? "text-up" : "text-down"}`}>
      {d > 0 ? "+" : "−"}
      {Math.abs(d).toLocaleString()}
    </span>
  );
}

export function PlayerName({
  id,
  name,
  shared,
  renamedFrom,
}: {
  id: number;
  name: string;
  shared?: boolean;
  renamedFrom?: string | null;
}) {
  return (
    <Link href={`/players/${id}`} className="group inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate font-medium text-ink group-hover:text-accent">{name.trim() || "(blank)"}</span>
      {renamedFrom && (
        <span
          title={`Previously ${renamedFrom}`}
          className="status-badge shrink-0 text-gem-purple"
        >
          new name
        </span>
      )}
      {shared && (
        <span
          title="More than one player on the board uses this name. We tell them apart by score."
          className="status-badge shrink-0 text-muted"
        >
          dup
        </span>
      )}
    </Link>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state rounded-xl border border-line bg-surface/40 px-6 py-12 text-center">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-accent/20 bg-accent/5"><BrandGlyph size={48} /></div>
      <p className="font-display text-xl font-bold tracking-tight">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat-tile rounded-xl bg-surface/80 px-4 py-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="num mt-3 break-words font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{value}</div>
      {hint && <div className="mt-2 text-xs leading-relaxed text-faint">{hint}</div>}
    </div>
  );
}
