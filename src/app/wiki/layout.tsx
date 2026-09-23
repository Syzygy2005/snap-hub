import { WikiTabs } from "@/components/wiki-reference";
import { WikiBreadcrumbs } from "@/components/wiki-breadcrumbs";
import { VariantToolsProvider } from "@/components/variant-tools";
import { currentAccount } from "@/lib/auth/session";
import { discordConfig } from "@/lib/auth/discord";
import { savedVariants } from "@/lib/wiki/collection";
export default async function WikiLayout({children}: {children:React.ReactNode}) {
  const account=await currentAccount();
  return <section className="wiki"><WikiTabs/><WikiBreadcrumbs/><VariantToolsProvider key={account?.id ?? "guest"} signedIn={!!account} enabled={!!discordConfig()} saved={account?await savedVariants(account.id):[]}>{children}</VariantToolsProvider></section>;
}
