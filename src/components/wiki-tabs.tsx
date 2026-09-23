"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WIKI_SECTIONS } from "@/lib/wiki/sections";
export function WikiTabs() {
  const pathname = usePathname();
  return <nav aria-label="Wiki sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line text-sm font-semibold">
    {WIKI_SECTIONS.map(({href,label}) => {
      const active = href === "/wiki" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-3 transition-colors ${active ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>;
    })}
  </nav>;
}
