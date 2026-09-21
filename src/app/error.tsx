"use client";

import Link from "next/link";

export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-lg rounded-xl border border-line bg-surface p-6 text-center sm:my-10">
      <h1 className="text-xl font-semibold">We couldn&apos;t load this page</h1>
      <p className="mt-3 text-sm text-muted">There may be a temporary connection problem. Try loading it again.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={retry} className="rounded-md bg-accent px-4 py-2 font-semibold text-bg hover:bg-accent-strong">
          Try again
        </button>
        <Link href="/" className="rounded-md border border-line px-4 py-2 font-semibold hover:border-accent">
          Back home
        </Link>
      </div>
    </section>
  );
}
