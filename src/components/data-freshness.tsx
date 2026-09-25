"use client";

import { RelativeTime, useNow } from "./relative-time";

export function DataFreshness({ checkedAt, archived = false, inline = false }: { checkedAt: string | null; archived?: boolean; inline?: boolean }) {
  const now = useNow();
  if (archived) return <p className={inline ? "text-xs text-muted" : "mb-4 text-sm text-muted"}>Archived season · these standings no longer refresh.</p>;
  const delayed = checkedAt && now !== null && now - new Date(checkedAt).getTime() > 30 * 60_000;
  return <p role="status" className={`${inline ? "text-xs leading-relaxed" : "mb-4 rounded-lg border border-line px-3 py-2 text-sm"} ${delayed ? "text-gold" : "text-muted"}`}>
    {!checkedAt ? "No successful source check recorded yet." : <>{delayed ? "Updates delayed" : "Source checked"} · <RelativeTime iso={checkedAt} />.</>}
    {" "}The leaderboard is checked every 10 minutes.{delayed && " Showing the last available standings."}
  </p>;
}
