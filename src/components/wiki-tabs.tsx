"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WIKI_GROUPS, WIKI_SECTIONS, wikiSectionPath } from "@/lib/wiki/sections";
export function WikiTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const comparing = pathname === "/wiki/compare";
  const selected = comparing ? "/wiki/compare" : wikiSectionPath(pathname);
  const group = WIKI_GROUPS.find((g) => g.hrefs.includes(comparing ? "/wiki/variants" : selected)) ?? WIKI_GROUPS[0];
  return <div className="mb-8">
    <label className="mb-3 block md:hidden">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">Explore the wiki</span>
      <select aria-label="Wiki page" value={selected} onChange={(e) => router.push(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-base text-ink">
        {WIKI_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>
          {g.hrefs.map((href) => <option key={href} value={href}>{WIKI_SECTIONS.find((s) => s.href === href)!.label}</option>)}
          {comparing && g === group && <option value="/wiki/compare">Compare</option>}
        </optgroup>)}
      </select>
    </label>
    <nav aria-label="Wiki groups" className="hidden gap-6 border-b border-line/60 md:flex">
      {WIKI_GROUPS.map((g) => <Link key={g.label} href={g.hrefs[0]} aria-current={g === group ? "true" : undefined} className={`border-b-2 py-3 text-sm font-semibold ${g === group ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>{g.label}</Link>)}
    </nav>
    <nav aria-label="Wiki sections" className="flex flex-wrap gap-2 pt-3 text-sm">
      {group.hrefs.map((href) => <Link key={href} href={href} aria-current={selected === href ? "page" : undefined} className={`rounded-full px-3 py-2 font-medium ${selected === href ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"}`}>{WIKI_SECTIONS.find((s) => s.href === href)!.label}</Link>)}
      {comparing && <span aria-current="page" className="rounded-full bg-accent/10 px-3 py-2 font-medium text-accent">Compare</span>}
    </nav>
  </div>;
}
