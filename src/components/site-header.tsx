import Link from "next/link";
import { BrandLogo } from "./brand";
import { SITE_NAME } from "@/lib/config";
import { discordConfig } from "@/lib/auth/discord";
import { currentAccount } from "@/lib/auth/session";
import { AccountMenu } from "./account-menu";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  // Read the session unconditionally, and first. A header showing who is signed in can never
  // be prerendered, and skipping the read whenever Discord looks unconfigured let statically
  // rendered pages bake in a signed-out header at build time and keep it forever.
  const account = await currentAccount();
  const enabled = !!discordConfig();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${SITE_NAME} home`}>
          <BrandLogo />
        </Link>

        <NavLinks />

        <form action="/players" className="order-last w-full sm:ml-auto sm:w-44 xl:order-none">
          <label className="sr-only" htmlFor="player-search">
            Search players
          </label>
          <input
            id="player-search"
            name="q"
            type="search"
            placeholder="Search players…"
            className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none sm:w-44 sm:text-sm"
          />
        </form>

        <AccountMenu account={enabled ? account : null} enabled={enabled} />
      </div>
      <div className="brand-rule h-px opacity-40" aria-hidden />
    </header>
  );
}
