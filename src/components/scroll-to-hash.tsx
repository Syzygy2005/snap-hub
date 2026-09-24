"use client";
import { useEffect } from "react";

/**
 * Scrolls to the URL's anchor once the content holding it has arrived.
 *
 * Card variants stream in behind Suspense, after the rest of the card page. A link to one
 * variant (search results use them) can therefore land before its anchor exists: the browser, or
 * Next's own hash scroll, looks for the element, finds nothing and gives up, and the page stays
 * at the top. Rendered at the end of the streamed section, this runs once the anchors are in the
 * document. It leaves the page alone when the target is already on screen, so it never fights a
 * scroll that did work, and it opens the unreleased-variants disclosure when the target is in it.
 */
export function ScrollToHash({ prefix }: { prefix: string }) {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash.startsWith(prefix)) return;
    let target = document.getElementById(hash);
    if (!target) {
      try { target = document.getElementById(decodeURIComponent(hash)); } catch { return; }
    }
    if (!target) return;
    const closed = target.closest("details:not([open])");
    if (closed instanceof HTMLDetailsElement) closed.open = true;
    const box = target.getBoundingClientRect();
    if (box.top >= 0 && box.top < window.innerHeight && !closed) return;
    target.scrollIntoView({ block: "start" });
  }, [prefix]);
  return null;
}
