"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Decorative pointer response. The outer hit area stays still; only artwork tilts. */
export function InteractiveArt({ children, className = "" }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const allowed = useRef(false);
  const point = useRef({ x: .5, y: .5 });
  const reset = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const el = root.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
    el.dataset.engaged = "false";
  };
  useEffect(() => {
    const media = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => { allowed.current = media.matches; if (!media.matches) reset(); };
    update();
    media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);
  return <div ref={root} className={`brand-art ${className}`} onPointerMove={event => {
    if (!allowed.current || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    point.current = { x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = root.current;
      if (!el || !allowed.current) return;
      const { x, y } = point.current;
      el.style.setProperty("--tilt-x", `${(.5 - y) * 8}deg`);
      el.style.setProperty("--tilt-y", `${(x - .5) * 8}deg`);
      el.style.setProperty("--shine-x", `${x * 100}%`);
      el.style.setProperty("--shine-y", `${y * 100}%`);
      el.dataset.engaged = "true";
    });
  }} onPointerLeave={reset} onPointerCancel={reset}>
    <div className="brand-art-stage">{children}<span className="brand-art-sheen" aria-hidden="true" /></div>
  </div>;
}
