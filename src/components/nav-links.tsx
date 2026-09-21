"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const GROUPS = [
  { href: "/wiki", label: "Wiki", children: [["/wiki", "Overview"], ["/wiki/cards", "Cards"], ["/wiki/locations", "Locations"]] },
  { href: "/leaderboard", label: "Leaderboard", children: [["/leaderboard", "Rankings"], ["/leaderboard/movers", "Movers"], ["/players", "Find a player"]] },
  { href: "/decks", label: "Decks", children: [["/decks", "Explore decks"], ["/decks/builder", "Deck Builder"]] },
  { href: "/stats", label: "Stats", children: [["/stats", "Community stats"], ["/stats/me", "My Stats"], ["/stats/tracker", "Tracker setup"]] },
  { href: "/news", label: "News", children: [] },
];

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
        {group.children.length > 0 && <div id={panelId} inert={!shown} className={`nav-disclosure ${mobile ? "" : "absolute left-0 top-full z-50 min-w-52 pt-2"}`}>
          <div className="overflow-hidden">
            <div className={`flex flex-col gap-1 rounded-lg border border-line p-2 ${mobile ? "my-1 bg-surface/50" : "bg-bg shadow-xl"}`}>
              {group.children.map(([href, label]) => <Link key={href} href={href}
                aria-current={pathname === href ? "page" : undefined}
                onClick={() => { close(); closeMobile(); }}
                className={`rounded-md px-3 py-2.5 text-sm hover:bg-surface-2 hover:text-ink ${pathname === href ? "bg-surface text-accent" : "text-muted"}`}>{label}</Link>)}
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
