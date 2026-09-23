import { WikiTabs } from "@/components/wiki-reference";
import { WikiBreadcrumbs } from "@/components/wiki-breadcrumbs";
import { VariantToolsProvider } from "@/components/variant-tools";
import { currentAccount } from "@/lib/auth/session";
import { discordConfig } from "@/lib/auth/discord";
// Saved variants are not read here. This layout wraps every wiki page, the guides and the
// terminology included, and it used to read the visitor's whole collection for all of them and
// send it with each one. The Owned/Wanted buttons now ask for it when they first appear.
export default async function WikiLayout({children}: {children:React.ReactNode}) {
  const account=await currentAccount();
  return <section className="wiki"><WikiTabs/><WikiBreadcrumbs/><VariantToolsProvider key={account?.id ?? "guest"} signedIn={!!account} enabled={!!discordConfig()}>{children}</VariantToolsProvider></section>;
}
