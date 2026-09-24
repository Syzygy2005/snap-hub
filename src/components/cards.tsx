import type { Card } from "@/lib/cards/types";
import { artSrc } from "@/lib/art";

/** Renders Snap Zone ability text, turning <span>Keyword</span> markers into bold text without using HTML. */
export function AbilityText({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return <span className={`italic text-faint ${className}`}>No ability</span>;
  const parts = text.split(/<span>(.*?)<\/span>/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-ink">
            {part}
          </strong>
        ) : (
          <span key={i}>{part.replace(/<\/?span>/g, "")}</span>
        ),
      )}
    </span>
  );
}

export function CardArt({
  card,
  className = "",
  eager = false,
}: {
  card: Pick<Card, "art" | "name">;
  className?: string;
  eager?: boolean;
}) {
  return (
    // Served through /art (see lib/art.ts), not next/image: the optimizer would bill a
    // transformation per card and size, where /art passes the source file through once.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={artSrc(card.art)}
      alt={card.name}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={`aspect-square w-full object-contain ${className}`}
    />
  );
}

export const COST_BUCKETS = [0, 1, 2, 3, 4, 5, 6] as const; // 6 = 6+

export function EnergyCurve({ cards, className = "" }: { cards: Pick<Card, "cost">[]; className?: string }) {
  const counts = COST_BUCKETS.map((b) => cards.filter((c) => (b === 6 ? c.cost >= 6 : c.cost === b)).length);
  const max = Math.max(4, ...counts);
  return (
    <div className={className}>
      <div className="flex h-20 items-end gap-1.5" role="img" aria-label={`Energy curve: ${counts.map((n, i) => `${n} at ${i === 6 ? "6+" : i}`).join(", ")}`}>
        {counts.map((n, i) => (
          <div key={i} className="relative h-16 flex-1">
            <span className="curve-count num absolute inset-x-0 mb-1 text-center text-[11px] text-muted" style={{ bottom: `${(n / max) * 100}%` }}>{n || ""}</span>
            <div
              className="energy-bar absolute bottom-0 w-full rounded-t bg-gradient-to-t from-accent-deep to-accent"
              data-count={n}
              style={{ height: `${(n / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 border-t border-line pt-1">
        {COST_BUCKETS.map((b) => (
          <span key={b} className="num flex-1 text-center text-[11px] text-faint">
            {b === 6 ? "6+" : b}
          </span>
        ))}
      </div>
    </div>
  );
}
