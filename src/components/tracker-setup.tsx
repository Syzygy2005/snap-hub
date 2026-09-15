"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { saveTrackerKey } from "@/lib/stats/client-key";

const subscribeNoop = () => () => {};

export function TrackerSetup({ inviteRequired }: { inviteRequired: boolean }) {
  const origin = useSyncExternalStore(subscribeNoop, () => window.location.origin, () => "https://your-site.vercel.app");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\\Downloads\\snaphub-tracker.ps1" -Site ${origin}`;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("blocked");
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tracker/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, inviteCode: invite }),
      });
      const body = (await res.json()) as { ok: boolean; token?: string; error?: string };
      if (!body.ok || !body.token) throw new Error(body.error ?? "Couldn't create a key");
      saveTrackerKey(body.token);
      setToken(body.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a key");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ol className="space-y-4">
      <Step n={1} title="Make your tracker key">
        {token ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              This is your key. It&apos;s saved in this browser for <Link href="/stats/me" className="text-accent hover:underline">My stats</Link>,
              and the tracker asks for it the first time it runs. Keep it private; anyone with it can add games to your stats.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 break-all rounded-md border border-accent/40 bg-bg px-3 py-2 font-mono text-sm text-accent">{token}</code>
              <button
                type="button"
                onClick={() => copy(token, "key")}
                className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-bg hover:bg-accent-strong"
              >
                {copied === "key" ? "Copied!" : "Copy key"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={create} className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted sm:max-w-xs">
              Display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 30))}
                required
                placeholder="Your Snap name"
                className="rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </label>
            {inviteRequired && (
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted sm:max-w-[12rem]">
                Invite code
                <input
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  required
                  className="rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </label>
            )}
            <button
              disabled={busy}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-strong disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create key"}
            </button>
            {error && <p className="w-full text-sm text-down">{error}</p>}
          </form>
        )}
      </Step>

      <Step n={2} title="Download the tracker">
        <p className="mb-2 text-sm text-muted">
          A small PowerShell script (built into Windows, nothing to install). It&apos;s plain text: open it in Notepad to read
          exactly what it does before running it.
        </p>
        <a
          href="/tracker/snaphub-tracker.ps1"
          download
          className="inline-block rounded-md border border-accent px-4 py-2 text-sm font-semibold hover:bg-accent/10"
        >
          Download snaphub-tracker.ps1
        </a>
      </Step>

      <Step n={3} title="Run it while you play">
        <p className="mb-2 text-sm text-muted">
          Open <strong className="text-ink">PowerShell</strong> (Start menu → type PowerShell) and paste this. Leave the window
          open while you play Marvel Snap on PC. Next time, run the same line again; it remembers your key.
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <code className="min-w-0 flex-1 break-all rounded-md border border-line bg-bg px-3 py-2 font-mono text-xs text-muted">
            {command}
          </code>
          <button
            type="button"
            onClick={() => copy(command, "command")}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:border-accent"
          >
            {copied === "command" ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-xs text-faint">
          <code>-ExecutionPolicy Bypass</code> lets this one script run without changing your PC&apos;s settings. If you saved the
          file somewhere other than Downloads, change the path.
        </p>
      </Step>

      <Step n={4} title="Play">
        <p className="text-sm text-muted">
          After each game the window shows the result, like <code className="text-up">WIN +4 cubes | My Deck vs Someone</code>.
          Your games appear in <Link href="/stats/me" className="text-accent hover:underline">My stats</Link> and count towards
          the <Link href="/stats" className="text-accent hover:underline">meta stats</Link>.
        </p>
      </Step>
    </ol>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-xl border border-line bg-surface p-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-accent font-display text-sm font-bold text-bg">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wider">{title}</h2>
        {children}
      </div>
    </li>
  );
}
