"use client";
import { useEffect, useRef, useState } from "react";
import { InteractiveArt } from "./interactive-art";
import { artSrc } from "@/lib/art";

/**
 * One more try before "Artwork unavailable". The first fetch of an image goes to the source, which
 * refuses now and then, and `/art` never caches a refusal, so a fresh <img> with the same address
 * asks again (checked in Chromium: two requests, the second one loaded). The pause is a choice.
 */
export const RETRY_MS = 2_000;

export function WikiArt({ name, art, featured = false }: { name: string; art: string; featured?: boolean }) {
  const [state, setState] = useState<"first" | "waiting" | "retry" | "failed">("first");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const failed = () => {
    if (state !== "first") return setState("failed");
    setState("waiting");
    timer.current = setTimeout(() => setState("retry"), RETRY_MS);
  };
  const box = "flex aspect-square items-center justify-center p-8 text-center text-muted";
  const image = <div className="relative">
    {!art || state === "failed"
      ? <div className={box} role="img" aria-label={`${name}: artwork unavailable`}>Artwork unavailable</div>
      : state === "waiting"
        ? <div className={box} role="img" aria-label={`${name}: artwork loading`} />
        : /* eslint-disable-next-line @next/next/no-img-element */
          <img key={state} src={artSrc(art)} alt={name} onError={failed} loading={featured ? "eager" : "lazy"} decoding="async" draggable={false} className="aspect-square w-full object-contain" />}
  </div>;
  return featured ? <InteractiveArt>{image}</InteractiveArt> : image;
}
