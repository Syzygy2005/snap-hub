"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HistoryPoint } from "@/lib/leaderboard/queries";

type Metric = "rank" | "score";

const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };

export function HistoryChart({ points, endAt }: { points: HistoryPoint[]; endAt: string }) {
  const [metric, setMetric] = useState<Metric>("rank");
  const [measured, setWidth] = useState<number | null>(null);
  const width = measured ?? 720;
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Values hold until the next change, so extend the last value to the latest snapshot.
  const series = useMemo(() => {
    const pts = points.map((p) => ({ t: new Date(p.at).getTime(), rank: p.rank, score: p.score }));
    const last = pts.at(-1);
    const end = new Date(endAt).getTime();
    if (last && end > last.t) pts.push({ ...last, t: end });
    return pts;
  }, [points, endAt]);

  if (series.length < 2) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted">
        Only one data point so far. The chart fills in as new snapshots come in.
      </p>
    );
  }

  const value = (p: (typeof series)[number]) => (metric === "rank" ? p.rank : p.score);
  const values = series.map(value).filter((v): v is number => v !== null);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min = metric === "rank" ? Math.max(1, Math.floor(min - span * 0.08)) : Math.floor(min - span * 0.08);
  max = Math.ceil(max + span * 0.08);

  const t0 = series[0].t;
  const t1 = series.at(-1)!.t;
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * innerW;
  // Rank 1 at the top.
  const y = (v: number) =>
    metric === "rank" ? PAD.top + ((v - min) / (max - min)) * innerH : PAD.top + (1 - (v - min) / (max - min)) * innerH;

  // Step path, broken where the player was off the board.
  let d = "";
  let prev: { x: number; y: number } | null = null;
  for (const p of series) {
    const v = value(p);
    if (v === null) {
      prev = null;
      continue;
    }
    const px = x(p.t);
    const py = y(v);
    d += prev ? ` H${px.toFixed(1)} V${py.toFixed(1)}` : ` M${px.toFixed(1)} ${py.toFixed(1)}`;
    prev = { x: px, y: py };
  }

  const ticks = [...new Set(Array.from({ length: 5 }, (_, i) => Math.round(min + ((max - min) * i) / 4)))];
  const dayMs = 86_400_000;
  const multiDay = t1 - t0 > dayMs * 1.5;
  const tickCount = Math.min(6, Math.max(2, Math.floor(innerW / 120)));
  const timeTicks = Array.from({ length: tickCount }, (_, i) => t0 + ((t1 - t0) * i) / (tickCount - 1));
  const fmtTime = (t: number) =>
    new Date(t).toLocaleString(
      "en-US",
      multiDay ? { month: "short", day: "numeric" } : { hour: "numeric", minute: "2-digit" },
    );

  const hovered = hover !== null ? series[hover] : null;
  const color = metric === "rank" ? "var(--color-gem-purple)" : "var(--color-gold)";

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left - PAD.left) / innerW) * (t1 - t0);
    // Last point at or before the cursor (step semantics).
    let idx = 0;
    for (let i = 0; i < series.length; i++) if (series[i].t <= t) idx = i;
    setHover(idx);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <div
          className="inline-flex rounded-lg border border-line bg-bg p-0.5 text-xs"
          role="group"
          aria-label="Chart metric"
        >
          {(["rank", "score"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={`rounded-md px-2.5 py-1 font-medium ${metric === m ? "bg-surface-3 text-ink" : "text-muted hover:text-ink"}`}
            >
              {m === "rank" ? "Rank" : "Points"}
            </button>
          ))}
        </div>
        <div className="num text-xs text-muted" aria-live="polite">
          {hovered ? (
            <>
              {new Date(hovered.t).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
              <span className="text-ink">{hovered.rank === null ? "off board" : `#${hovered.rank}`}</span> ·{" "}
              <span className="text-gold">{hovered.score.toLocaleString()} pts</span>
            </>
          ) : (
            "Hover the chart for details"
          )}
        </div>
      </div>
      <div ref={wrap} className="w-full" style={{ height: HEIGHT }}>
        {measured !== null && (
          <svg
            width={width}
            height={HEIGHT}
            className="block touch-none select-none"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label={`${metric === "rank" ? "Rank" : "Points"} over time`}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="var(--color-line)"
                  strokeDasharray="2 4"
                />
                <text x={PAD.left - 8} y={y(v)} dy="0.35em" textAnchor="end" className="num fill-faint text-[11px]">
                  {metric === "rank" ? `#${v}` : v.toLocaleString()}
                </text>
              </g>
            ))}
            {timeTicks.map((t, i) => (
              <text
                key={i}
                x={x(t)}
                y={HEIGHT - 8}
                textAnchor={i === 0 ? "start" : i === timeTicks.length - 1 ? "end" : "middle"}
                className="fill-faint text-[11px]"
              >
                {fmtTime(t)}
              </text>
            ))}
            <path d={d} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" />
            {hovered && value(hovered) !== null && (
              <g>
                <line
                  x1={x(hovered.t)}
                  x2={x(hovered.t)}
                  y1={PAD.top}
                  y2={HEIGHT - PAD.bottom}
                  stroke="var(--color-muted)"
                  strokeOpacity={0.4}
                />
                <circle
                  cx={x(hovered.t)}
                  cy={y(value(hovered)!)}
                  r={4.5}
                  fill={color}
                  stroke="var(--color-bg)"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
