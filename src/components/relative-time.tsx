"use client";

import { useSyncExternalStore } from "react";

// One shared ticking clock for every relative timestamp on the page.
let current = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => current || (current = Date.now());
const getServerSnapshot = () => null;

/** Current time on the client; null during server render and hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function formatRelative(iso: string, now: number): string {
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  if (diff < 45) return "just now";
  const units: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let value = diff;
  for (let i = 0; i < units.length; i++) {
    const [size, unit] = units[i];
    if (Math.abs(value) < size || i === units.length - 1) {
      const rounded = Math.round(value);
      return `${rounded} ${unit}${rounded === 1 ? "" : "s"} ago`;
    }
    value /= size;
  }
  return "";
}

/**
 * Coarse wording for the leaderboard's last-played column. The board only refreshes every half
 * hour, so "12 minutes ago" would be inventing precision the snapshots don't have.
 */
export function formatLastMoved(iso: string, now: number): string {
  const hours = Math.floor((now - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "under an hour ago";
  if (hours < 24) return hours === 1 ? "over an hour ago" : `over ${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "over a day ago" : `over ${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "over a week ago" : `over ${weeks} weeks ago`;
}

export function RelativeTime({ iso }: { iso: string }) {
  const now = useNow();
  const absolute = new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  return (
    <time dateTime={iso} title={`${absolute} UTC`}>
      {now === null ? `${absolute} UTC` : formatRelative(iso, now)}
    </time>
  );
}
