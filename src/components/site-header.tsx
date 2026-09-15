import Link from "next/link";
import { SITE_NAME } from "@/lib/config";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${SITE_NAME} home`}>
          <BrandIcon className="h-10 w-10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark.png" alt="" width={460} height={138} className="h-7 w-auto" />
        </Link>

        <NavLinks />

        <form action="/players" className="ml-auto w-full sm:w-auto">
          <label className="sr-only" htmlFor="player-search">
            Search players
          </label>
          <input
            id="player-search"
            name="q"
            type="search"
            placeholder="Search players…"
            className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none sm:w-52"
          />
        </form>
      </div>
      <div className="brand-rule h-px opacity-40" aria-hidden />
    </header>
  );
}

export function BrandIcon({ className = "h-8 w-8" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/icon.png" alt="" width={160} height={160} className={className} />;
}
