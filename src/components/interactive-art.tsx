"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Keep the hit area still; interpolate decorative motion independently of React renders. */
export function InteractiveArt({ children, className = "" }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const media = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame: number | null = null;
    let previous = 0;
    let x = .5, y = .5, targetX = .5, targetY = .5;
    const paint = () => {
      el.style.setProperty("--tilt-x", `${(.5 - y) * 8}deg`);
      el.style.setProperty("--tilt-y", `${(x - .5) * 8}deg`);
      el.style.setProperty("--shine-x", `${x * 100}%`);
      el.style.setProperty("--shine-y", `${y * 100}%`);
    };
    const tick = (now: number) => {
      // Time-based damping feels consistent on 60Hz and high-refresh displays.
      const blend = 1 - Math.exp(-Math.min(now - previous, 64) / 85);
      previous = now;
      x += (targetX - x) * blend;
      y += (targetY - y) * blend;
      if (Math.abs(targetX - x) + Math.abs(targetY - y) < .0005) {
        x = targetX; y = targetY; frame = null;
      } else frame = requestAnimationFrame(tick);
      paint();
    };
    const start = () => {
      if (frame !== null) return;
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const reset = () => {
      el.dataset.engaged = "false";
      targetX = targetY = .5;
      if (media.matches) start();
      else {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null; x = y = .5; paint();
      }
    };
    const move = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse") return;
      const bounds = el.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      targetX = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      targetY = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      el.dataset.engaged = "true";
      start();
    };
    reset();
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", reset);
    el.addEventListener("pointercancel", reset);
    media.addEventListener("change", reset);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", reset);
      el.removeEventListener("pointercancel", reset);
      media.removeEventListener("change", reset);
    };
  }, []);
  return <div ref={root} className={`brand-art ${className}`}>
    <div className="brand-art-stage">{children}<span className="brand-art-sheen" aria-hidden="true" /></div>
  </div>;
}
