export const SITE_NAME = "Snap Hub";
export const SITE_SLOGAN = "Build / Track / Compete";
export const SITE_TAGLINE = "Play. Collect. Improve. Belong.";

// Marvel Snap's API accepts these region values, but as of Sept 2026 only "global"
// returns data (the others error server-side). Extra regions are tried when listed in
// LEADERBOARD_REGIONS, e.g. "global,america,europe,asia,others".
export const ALL_REGIONS = ["global", "america", "europe", "asia", "others"] as const;
export type Region = (typeof ALL_REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  global: "Global",
  america: "America",
  europe: "Europe",
  asia: "Asia",
  others: "Others",
};

export function trackedRegions(): Region[] {
  const raw = process.env.LEADERBOARD_REGIONS ?? "global";
  const list = raw
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter((r): r is Region => (ALL_REGIONS as readonly string[]).includes(r));
  return list.length ? list : ["global"];
}

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && (ALL_REGIONS as readonly string[]).includes(value);
}

// A player whose rank drifts without their score changing gets a fresh history row at most this often.
export const RANK_DRIFT_INTERVAL_MS = 6 * 60 * 60 * 1000;
