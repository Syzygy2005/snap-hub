import type { Metadata } from "next";
import { canonicalOrigin } from "@/lib/site-origin";
import Link from "next/link";
import { Montserrat, Orbitron } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME, SITE_SLOGAN, SITE_TAGLINE } from "@/lib/config";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
const orbitron = Orbitron({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-orbitron" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} · ${SITE_SLOGAN}`, template: `%s · ${SITE_NAME}` },
  description: SITE_TAGLINE,
  metadataBase: new URL(canonicalOrigin(new Request("https://snap-hub.app"))),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${montserrat.variable} ${orbitron.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-3 focus:font-semibold focus:text-bg"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 scroll-mt-48 px-4 pb-16 pt-6 sm:px-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs leading-relaxed text-faint sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <p className="max-w-3xl">
              {SITE_NAME} is a fan-made project, not affiliated with or endorsed by Marvel, Second Dinner or Nuverse. MARVEL
              SNAP, card art and Marvel characters belong to their owners. Built on public data and other people&apos;s
              open work.{" "}
              <Link href="/credits" className="font-medium text-muted underline-offset-2 hover:text-accent hover:underline">
                See credits
              </Link>{" "}
              or{" "}
              <Link href="/changelog" className="font-medium text-muted underline-offset-2 hover:text-accent hover:underline">
                what&apos;s new
              </Link>
              .
            </p>
            <p className="shrink-0 font-semibold uppercase tracking-[0.18em] text-accent/80">{SITE_TAGLINE}</p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
