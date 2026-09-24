import type { Metadata } from "next";
import { canonicalOrigin } from "@/lib/site-origin";
import Link from "next/link";
import { Inter, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME, SITE_SLOGAN, SITE_TAGLINE } from "@/lib/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} · ${SITE_SLOGAN}`, template: `%s · ${SITE_NAME}` },
  description: SITE_TAGLINE,
  metadataBase: new URL(canonicalOrigin(new Request("https://snap-hub.app"))),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <head>
        {/* Apply the palette before the body is painted, independently of hydration: a saved choice
            if there is one, otherwise the device's own light or dark setting. Keep it in step with
            themeFor in theme-toggle.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: 'try{var s=null;try{s=localStorage.getItem("snaphub:theme")}catch(e){}document.documentElement.dataset.theme=s==="dark"||s==="light"?s:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}' }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-jade focus:px-4 focus:py-3 focus:font-semibold focus:text-forest"
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
            <p className="shrink-0 font-semibold uppercase tracking-[0.18em] text-accent">{SITE_TAGLINE}</p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
