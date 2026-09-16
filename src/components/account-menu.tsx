"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Account } from "@/lib/auth/session";
import { avatarUrl } from "@/lib/auth/discord";

export function AccountMenu({ account, enabled }: { account: Account | null; enabled: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Nothing to offer until the Discord app is configured, so don't advertise a dead end.
  if (!enabled) return null;

  if (!account) {
    return (
      <a
        href={`/api/auth/discord?return=${encodeURIComponent(pathname)}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-sm font-medium text-muted hover:border-accent/60 hover:text-ink"
      >
        <DiscordMark className="h-4 w-4" />
        Sign in
      </a>
    );
  }

  const src = avatarUrl(account.discordId, account.avatar);
  return (
    <div className="flex shrink-0 items-center gap-2">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={24} height={24} className="h-6 w-6 rounded-full" />
      ) : (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-3 text-[11px] font-bold">
          {account.username.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="max-w-24 truncate text-sm font-medium">{account.username}</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await fetch("/api/auth/signout", { method: "POST" });
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
        className="text-xs text-faint hover:text-down disabled:opacity-50"
      >
        Sign out
      </button>
    </div>
  );
}

function DiscordMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" className={className} fill="currentColor" aria-hidden>
      <path d="M20.3 1.6A19.8 19.8 0 0 0 15.4.1a14 14 0 0 0-.6 1.3 18.3 18.3 0 0 0-5.5 0A14 14 0 0 0 8.6.1 19.7 19.7 0 0 0 3.7 1.6C.6 6.2-.3 10.7.2 15.1a19.9 19.9 0 0 0 6 3 14.6 14.6 0 0 0 1.3-2.1 13 13 0 0 1-2-1c.2-.1.3-.2.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4a13 13 0 0 1-2 1 14.4 14.4 0 0 0 1.3 2.1 19.9 19.9 0 0 0 6-3c.6-5.1-.8-9.6-3.6-13.5ZM8.0 12.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 7.6 8 7.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}
