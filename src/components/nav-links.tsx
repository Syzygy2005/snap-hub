"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/leaderboard", label: "Leaderboard", match: (p: string) => p === "/leaderboard" || p.startsWith("/players") },
  { href: "/leaderboard/movers", label: "Movers", match: (p: string) => p.startsWith("/leaderboard/movers") },
  { href: "/decks/builder", label: "Deck Builder", match: (p: string) => p.startsWith("/decks/builder") },
  { href: "/decks", label: "Decks", match: (p: string) => p === "/decks" || /^\/decks\/(?!builder)/.test(p) },
  { href: "/stats", label: "Stats", match: (p: string) => p.startsWith("/stats") },
  { href: "/news", label: "News", match: (p: string) => p.startsWith("/news") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex items-center gap-0.5 overflow-x-auto text-sm [scrollbar-width:none]">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative whitespace-nowrap px-2.5 py-2 font-semibold uppercase tracking-wider text-[12px] transition-colors after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 ${
              active ? "text-accent after:bg-accent" : "text-muted hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
