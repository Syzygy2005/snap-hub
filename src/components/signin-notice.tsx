import Link from "next/link";

/**
 * The sign-in routes bounce failures back to the home page as ?signin=<reason>. Without this
 * the reason sat in the address bar and nothing said a word, so a failed sign-in looked like
 * a page that simply did nothing.
 */
const REASONS: Record<string, { text: string; retry: boolean }> = {
  unavailable: { text: "Sign-in isn't switched on for this site yet.", retry: false },
  cancelled: { text: "Sign-in was cancelled, so nothing changed.", retry: true },
  expired: { text: "That sign-in took too long or was interrupted. Starting again should work.", retry: true },
  failed: { text: "Discord couldn't finish the sign-in. Starting again should work.", retry: true },
};

export function SignInNotice({ reason }: { reason: string | undefined }) {
  const notice = reason ? REASONS[reason] : undefined;
  if (!notice) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-down/40 bg-down/10 px-4 py-3">
      <p className="min-w-0 text-sm">{notice.text}</p>
      {notice.retry && (
        <Link
          href="/api/auth/discord"
          className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm font-semibold hover:border-accent"
        >
          Try again
        </Link>
      )}
    </div>
  );
}
