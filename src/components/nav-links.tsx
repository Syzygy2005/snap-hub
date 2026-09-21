"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

const LINKS = [
  { href: "/wiki", label: "Wiki", match: (p: string) => p.startsWith("/wiki") },
  { href: "/leaderboard", label: "Leaderboard", match: (p: string) => p === "/leaderboard" || p.startsWith("/players") },
  { href: "/leaderboard/movers", label: "Movers", match: (p: string) => p.startsWith("/leaderboard/movers") },
  { href: "/decks/builder", label: "Deck Builder", match: (p: string) => p.startsWith("/decks/builder") },
  { href: "/decks", label: "Decks", match: (p: string) => p === "/decks" || /^\/decks\/(?!builder)/.test(p) },
  { href: "/stats", label: "Stats", match: (p: string) => p === "/stats" || p.startsWith("/stats/tracker") },
  { href: "/stats/me", label: "My Stats", match: (p: string) => p.startsWith("/stats/me") },
  { href: "/news", label: "News", match: (p: string) => p.startsWith("/news") },
];

export function NavLinks() {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const links = (
    <>
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => { if (menu.current) menu.current.open = false; }}
            aria-current={active ? "page" : undefined}
            className={`relative whitespace-nowrap px-2 py-2 text-[13px] font-semibold transition-colors after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 ${
              active ? "text-accent after:bg-accent" : "text-muted hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
  return <>
    <nav aria-label="Main navigation" className="hidden flex-wrap items-center gap-0.5 xl:flex">{links}</nav>
    <details ref={menu} className="brand-menu relative ml-auto xl:hidden" onKeyDown={(event) => {
      if (event.key === "Escape" && menu.current) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }}>
      <summary className="cursor-pointer rounded-md border border-line px-3 py-2 text-sm font-semibold">Menu</summary>
      <nav aria-label="Mobile navigation" className="absolute right-0 top-full z-50 mt-2 flex w-64 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-line bg-bg p-2 shadow-xl">{links}</nav>
    </details>
  </>;
}
