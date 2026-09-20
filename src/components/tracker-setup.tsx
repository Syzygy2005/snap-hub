"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { loadTrackerKey, saveTrackerKey } from "@/lib/stats/client-key";

const subscribeNoop = () => () => {};

export function TrackerSetup({ inviteRequired }: { inviteRequired: boolean }) {
  const origin = useSyncExternalStore(subscribeNoop, () => window.location.origin, () => "https://your-site.vercel.app");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const storedKey = useSyncExternalStore(subscribeNoop, loadTrackerKey, () => null);
  // A key made a moment ago, or one this browser already had, so coming back still works.
  const activeKey = token ?? storedKey;

  const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\\Downloads\\snaphub-tracker.ps1" -Site ${origin}`;

  const downloadZip = async (key: string) => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/tracker/download", { headers: { authorization: `Bearer ${key}` } });
      if (!res.ok) throw new Error("That key wasn't accepted. Make a new one above.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "snap-hub-tracker.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

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
              Name this key
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 30))}
                required
                placeholder="Gaming PC"
                className="rounded-md border border-line bg-bg px-3 py-2 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none sm:text-sm"
              />
            </label>
            {inviteRequired && (
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted sm:max-w-[12rem]">
                Invite code
                <input
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  required
                  className="rounded-md border border-line bg-bg px-3 py-2 text-base text-ink focus:border-accent focus:outline-none sm:text-sm"
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

      <Step n={2} title="Download your tracker">
        {activeKey ? (
          <>
            <p className="mb-2 text-sm text-muted">
              A zip with the tracker and a file that starts it. Your key is already in it, so there&apos;s nothing to paste.
              Don&apos;t pass the folder on: anyone who has it can add games to your stats.
            </p>
            <button
              type="button"
              onClick={() => downloadZip(activeKey)}
              disabled={downloading}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-strong disabled:opacity-50"
            >
              {downloading ? "Preparing…" : "Download snap-hub-tracker.zip"}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">Make a key above and your download appears here.</p>
        )}
      </Step>

      <Step n={3} title="Unpack it, then start it">
        <p className="text-sm text-muted">
          <strong className="text-ink">Unpack the zip first.</strong> Right-click it, choose Extract All, then Extract.
          Opening the zip and running the file straight from inside it doesn&apos;t work: Windows copies out only the file you
          clicked and leaves the tracker behind.
        </p>
        <p className="mt-2 text-sm text-muted">
          Then open the folder that appears and double-click <strong className="text-ink">Start Snap Hub Tracker.cmd</strong>.
          Leave the window open while you play Marvel Snap on PC. Windows asks once whether to run a file from the internet;
          choose Run. Start it the same way every time.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-faint hover:text-muted">Rather run it yourself?</summary>
          <p className="mt-2 text-sm text-muted">
            The tracker is a PowerShell script, plain text you can read in Notepad first. Download{" "}
            <a href="/tracker/snaphub-tracker.ps1" download className="text-accent hover:underline">
              snaphub-tracker.ps1
            </a>{" "}
            on its own and run this in PowerShell instead. It asks for your key the first time, then remembers it.
          </p>
          <div className="mt-2 flex flex-wrap items-start gap-2">
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
            <code>-ExecutionPolicy Bypass</code> lets this one script run without changing your PC&apos;s settings.
          </p>
        </details>
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
