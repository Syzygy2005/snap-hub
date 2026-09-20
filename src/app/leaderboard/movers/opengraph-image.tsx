import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/config";
import { getMovers, listSeasons } from "@/lib/leaderboard/queries";
import { seasonLabel } from "@/lib/season";

/**
 * The unfurl for a link to Movers: the biggest climbers of the last day, drawn at request time
 * so a shared link carries the board rather than a logo.
 *
 * No fonts and no images are loaded from disk. Satori would take either, but a file read here
 * is the same trap /api/tracker/download fell into, where Next cannot see the dependency and it
 * has to be listed in outputFileTracingIncludes; a broken unfurl is a quiet failure and not
 * worth that. Colours carry the brand instead.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The biggest climbers on the MARVEL SNAP Infinite leaderboard";
// The board only moves every ten minutes, so neither does this.
export const revalidate = 600;

const BG = "#0a0a0f";
const SURFACE = "#1a1a1f";
const LINE = "#2c2c35";
const INK = "#f5f7fa";
const MUTED = "#a1a7b3";
const FAINT = "#6b7180";
const ACCENT = "#ffd600";
const UP = "#22c55e";

/** Names run to 40 characters; past this one the row stops fitting on a 1200px card. */
export function clip(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 26 ? `${trimmed.slice(0, 25)}\u2026` : trimmed;
}

export default async function Image() {
  const [season] = await listSeasons("global");
  const movers = season ? await getMovers(season, "global", 24, 5) : null;
  const climbers = movers?.climbers.slice(0, 5) ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: INK,
          padding: "44px 64px",
          fontSize: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, color: ACCENT }}>
            {SITE_NAME.toUpperCase()}
          </span>
          <span style={{ fontSize: 20, color: FAINT, letterSpacing: 2 }}>
            {season ? seasonLabel(season).toUpperCase() : "INFINITE LEADERBOARD"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 10 }}>
          <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>Biggest climbers</span>
          <span style={{ fontSize: 26, color: MUTED }}>last 24 hours</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, gap: 10 }}>
          {climbers.length === 0 && (
            <span style={{ fontSize: 30, color: MUTED }}>
              The board has not moved enough to compare yet.
            </span>
          )}
          {climbers.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                background: SURFACE,
                border: `1px solid ${LINE}`,
                borderRadius: 6,
                padding: "10px 22px",
              }}
            >
              <span style={{ fontSize: 30, fontWeight: 700, color: ACCENT, width: 96 }}>#{c.rank}</span>
              <span
                style={{ fontSize: 32, flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}
              >
                {clip(c.name)}
              </span>
              <span style={{ fontSize: 30, fontWeight: 700, color: UP }}>
                &#9650; {typeof c.pastRank === "number" ? c.pastRank - c.rank : 0}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", paddingTop: 20, color: FAINT, fontSize: 22 }}>
          snap-hub.app &middot; the official top 1000, saved every 10 minutes
        </div>
      </div>
    ),
    size,
  );
}
