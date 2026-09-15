// Seasons are keyed "YYYY-MM", matching the month/year the leaderboard API uses.

export interface SeasonRef {
  year: number;
  month: number; // 1-12
}

export function seasonKey({ year, month }: SeasonRef): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseSeason(key: string): SeasonRef | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month };
}

export function currentSeason(now = new Date()): SeasonRef {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export function previousSeason({ year, month }: SeasonRef): SeasonRef {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function seasonLabel(key: string): string {
  const ref = parseSeason(key);
  if (!ref) return key;
  const date = new Date(Date.UTC(ref.year, ref.month - 1, 1));
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
