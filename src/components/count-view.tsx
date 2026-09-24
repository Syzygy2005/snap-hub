"use client";
import { useEffect } from "react";

/**
 * Counts this browser's view of a deck once. A refresh, a return visit or the deck page opened
 * again later adds nothing, and a chat app's link preview never runs this at all. If the browser
 * blocks storage it counts once per page load, which is what every view used to be.
 */
export function CountView({ id }: { id: string }) {
  useEffect(() => {
    const key = `snaphub:viewed:${id}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // Storage blocked: fall through and count this load.
    }
    fetch(`/api/decks/${encodeURIComponent(id)}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [id]);
  return null;
}
