import Link from "next/link";
import type { Card } from "@/lib/cards/types";
import type { BoardZone } from "@/lib/stats/parse-game";
import { CardArt } from "./cards";

/** Below this many games a rate uses neutral text rather than a positive/negative color. */
export const LOW_SAMPLE = 20;

export function pct(v: number | null, digits = 1) {
  return v === null ? "—" : `${(v * 100).toFixed(digits)}%`;
}

export function signed(v: number | null, digits = 2) {
  if (v === null) return "—";
  const s = Math.abs(v).toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export function WinRate({ value, games }: { value: number | null; games: number }) {
  const low = games < LOW_SAMPLE;
  const tone =
    value === null || low ? "text-muted" : value >= 0.53 ? "text-up" : value <= 0.47 ? "text-down" : "text-ink";
  return (
    <span className={`num font-semibold ${tone}`} title={low ? `Only ${games} game${games === 1 ? "" : "s"}` : undefined}>
      {pct(value)}
    </span>
  );
}

/**
 * Marks a row whose rates rest on fewer than LOW_SAMPLE games. Rows used to be faded for this,
 * which the cream palette dropped for contrast; greyed rates alone do not stand out when scanning
 * a table, so the count itself says so.
 */
export function SmallSample({ games }: { games: number }) {
  if (games >= LOW_SAMPLE) return null;
  return <span className="status-badge ml-1.5 align-middle text-muted" title={`Fewer than ${LOW_SAMPLE} games: treat these rates as a rough guess`}>small sample</span>;
}

export function CubeRate({ value, games }: { value: number | null; games: number }) {
  const low = games < LOW_SAMPLE;
  const tone = value === null || low ? "text-muted" : value > 0 ? "text-up" : value < 0 ? "text-down" : "text-ink";
  return <span className={`num font-semibold ${tone}`}>{signed(value)}</span>;
}

export function ShareBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="num w-12 text-right">{pct(value)}</span>
      <span className="hidden h-1.5 w-20 overflow-hidden rounded-sm bg-surface-3 sm:block" aria-hidden>
        <span className="share-bar block h-full bg-jade" style={{ width: `${Math.min(100, value * 100)}%` }} />
      </span>
    </span>
  );
}

export function CardStrip({
  ids,
  info,
  max = 12,
  className = "",
}: {
  ids: string[];
  info: Record<string, Pick<Card, "name" | "art" | "cost">>;
  max?: number;
  className?: string;
}) {
  const known = ids
    .filter((id) => info[id])
    .sort((a, b) => info[a].cost - info[b].cost || info[a].name.localeCompare(info[b].name))
    .slice(0, max);
  return (
    <span className={`flex gap-0.5 ${className}`}>
      {known.map((id) => (
        <span key={id} className="w-8 shrink-0" title={info[id].name}>
          <CardArt card={info[id]} />
        </span>
      ))}
    </span>
  );
}

export function ResultBadge({ result }: { result: "win" | "loss" | "tie" }) {
  const styles = {
    win: "bg-up/15 text-up",
    loss: "bg-down/15 text-down",
    tie: "bg-surface-3 text-muted",
  };
  return (
    <span className={`status-badge min-w-11 justify-center ${styles[result]}`}>
      {result}
    </span>
  );
}

type CardInfo = Record<string, Pick<Card, "name" | "art" | "cost">>;

/** Location ids come through as the game's own ids, like SanctumSanctorum. */
export function locationName(id: string | null): string | null {
  if (!id) return null;
  return id.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim() || null;
}

/** The three locations as they stood when the game ended, opponent on top like the game. */
export function BoardView({ zones, info, locations = {} }: { zones: BoardZone[]; info: CardInfo; locations?: Record<string, string> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {zones.map((z, i) => (
        <div key={i} className="rounded-lg border border-line bg-bg/40 p-2">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
            <span className="min-w-0 truncate">
              {z.location && locations[z.location] ? <Link className="text-accent underline" href={`/wiki/locations/${encodeURIComponent(z.location)}`}>{locations[z.location]}</Link> : locationName(z.location) ?? `Location ${i + 1}`}
            </span>
            {/* Only drawn when the game said this one was won. Its absence covers losing the
                location and tying it, which the file does not tell apart, so there is no
                matching "lost" badge to draw. */}
            {z.won && <span className="shrink-0 rounded bg-up/15 px-1.5 py-0.5 text-[10px] text-up">Won</span>}
          </div>
          <BoardSide label="Them" ids={z.opponent} info={info} />
          <div className="my-2 h-px bg-line" />
          <BoardSide label="You" ids={z.player} info={info} />
        </div>
      ))}
    </div>
  );
}

function BoardSide({ label, ids, info }: { label: string; ids: string[]; info: CardInfo }) {
  const known = ids.filter((id) => info[id]);
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-[10px] uppercase tracking-wider text-faint">{label}</span>
      {known.length ? (
        <CardStrip ids={known} info={info} max={4} />
      ) : (
        <span className="text-xs text-faint">empty</span>
      )}
    </div>
  );
}
