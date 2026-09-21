"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function WikiTabs() {
  const pathname = usePathname();
  return <nav aria-label="Wiki sections" className="mb-6 flex gap-1 border-b border-line text-sm font-semibold">
    {[["/wiki","Overview"],["/wiki/cards","Cards"],["/wiki/locations","Locations"]].map(([href,label]) => {
      const active = href === "/wiki" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`border-b-2 px-4 py-3 transition-colors ${active ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>;
    })}
  </nav>;
}
