"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { WIKI_SECTIONS } from "@/lib/wiki/sections";

const GROUPS = [
  { href: "/wiki", label: "Wiki", children: WIKI_SECTIONS.map((s) => [s.href, s.label, s.description]) },
  { href: "/leaderboard", label: "Leaderboard", children: [["/leaderboard", "Rankings", "See the Infinite leaderboard"], ["/leaderboard/movers", "Movers", "Follow the biggest rank changes"], ["/players", "Find a player", "Search player profiles"]] },
  { href: "/decks", label: "Decks", children: [["/decks", "Explore decks", "Discover community builds"], ["/decks/builder", "Deck Builder", "Create and refine your next deck"]] },
  { href: "/stats", label: "Stats", children: [["/stats", "Community stats", "Explore the shared game data"], ["/stats/me", "My Stats", "Review your own games"], ["/stats/tracker", "Tracker setup", "Connect your PC game tracker"]] },
  { href: "/news", label: "News", children: [] },
];

function NavIcon({ section }: { section: string }) {
  const paths: Record<string, string> = {
    Wiki: "M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z M13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2",
    Leaderboard: "M8 3h8v5a4 4 0 0 1-8 0z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 12v7 M8 21h8 M10 19h4",
    Decks: "M8 3h12v16H8z M5 6H3v15h12v-2",
    Stats: "M4 14h3v7H4z M10 9h3v12h-3z M16 3h3v18h-3z",
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[section]} /></svg>;
}

function Navigation({ mobile, closeMobile }: { mobile?: boolean; closeMobile: () => void }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<{ route: string; group: string } | null>(null);
  const root = useRef<HTMLElement>(null);
  const id = useId();
  const open = expanded?.route === pathname ? expanded.group : null;
  const close = () => setExpanded(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setExpanded(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <nav ref={root} aria-label={mobile ? "Mobile navigation" : "Main navigation"}
    className={mobile ? "flex flex-col" : "hidden items-center gap-1 xl:flex"}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    {GROUPS.map(group => {
      const active = pathname === group.href || pathname.startsWith(group.href + "/") || (group.href === "/leaderboard" && pathname.startsWith("/players"));
      const shown = open === group.href;
      const panelId = id + "-" + group.label;
      return <div key={group.href} className="nav-group relative" data-open={shown} onKeyDown={event => {
        if (event.key === "Escape" && shown) {
          event.preventDefault(); event.stopPropagation(); close();
          event.currentTarget.querySelector("button")?.focus();
        }
      }}>
        <div className={`flex items-center rounded-md ${active ? "bg-surface text-accent" : "text-muted"}`}>
          <Link href={group.href} aria-current={pathname === group.href ? "page" : undefined}
            onClick={() => { close(); closeMobile(); }}
            className="flex-1 whitespace-nowrap rounded-md px-3 py-2.5 text-[13px] font-semibold hover:text-ink">{group.label}</Link>
          {group.children.length > 0 && <button type="button" aria-label={group.label + " options"} aria-expanded={shown} aria-controls={panelId}
            onClick={() => setExpanded(shown ? null : { route: pathname, group: group.href })}
            className="nav-toggle flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-surface-2 hover:text-ink">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>}
        </div>
        {group.children.length > 0 && <div id={panelId} inert={!shown} className={`nav-disclosure ${mobile ? "" : "absolute left-0 top-full z-50 w-72 pt-2"}`}>
          <div className="overflow-hidden">
            <div className={`flex max-h-[65dvh] flex-col gap-1 overflow-y-auto rounded-lg border border-line p-2 ${mobile ? "my-1 bg-surface/50" : "bg-bg shadow-xl"}`}>
              {group.children.map(([href, label, description]) => <Link key={href} href={href} aria-label={label}
                aria-current={pathname === href ? "page" : undefined}
                onClick={() => { close(); closeMobile(); }}
                className={`flex items-start gap-3 rounded-md px-3 py-3 text-sm hover:bg-surface-2 hover:text-ink ${pathname === href ? "bg-surface text-accent" : "text-muted"}`}><span className="mt-0.5 text-accent"><NavIcon section={group.label} /></span><span><span className="block font-semibold">{label}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span></span></Link>)}
            </div>
          </div>
        </div>}
      </div>;
    })}
  </nav>;
}

export function NavLinks() {
  const menu = useRef<HTMLDetailsElement>(null);
  const closeMobile = () => { if (menu.current) menu.current.open = false; };
  return <>
    <Navigation closeMobile={closeMobile} />
    <details ref={menu} className="brand-menu ml-auto xl:hidden" onKeyDown={event => {
      if (event.key === "Escape") { closeMobile(); menu.current?.querySelector("summary")?.focus(); }
    }}>
      <summary className="cursor-pointer rounded-md border border-line px-3 py-2 text-sm font-semibold">Menu</summary>
      <div className="absolute right-4 top-full z-50 mt-2 max-h-[70dvh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-line bg-bg p-2 shadow-xl">
        <Navigation mobile closeMobile={closeMobile} />
      </div>
    </details>
  </>;
}
