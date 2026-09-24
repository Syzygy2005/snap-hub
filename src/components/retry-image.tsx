"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * One more try before giving up on an image. The first fetch of a card image goes to the source,
 * which refuses now and then, and `/art` never caches a refusal, so a fresh <img> with the same
 * address asks again (checked in Chromium: two requests, the second one loaded). While it waits
 * nothing is drawn but `waiting`, so no broken-image icon flashes. The pause is a choice.
 */
export const RETRY_MS = 2_000;

export function RetryImage({ src, alt, eager = false, className, waiting, fallback }: {
  src: string;
  alt: string;
  eager?: boolean;
  className: string;
  waiting: ReactNode;
  fallback: ReactNode;
}) {
  const [state, setState] = useState<"first" | "waiting" | "retry" | "failed">("first");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (state === "failed") return fallback;
  if (state === "waiting") return waiting;
  const failed = () => {
    if (state !== "first") return setState("failed");
    setState("waiting");
    timer.current = setTimeout(() => setState("retry"), RETRY_MS);
  };
  // The key makes the retry a new element, which is what sends the browser back to the server.
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={state} src={src} alt={alt} onError={failed} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} className={className} />;
}
