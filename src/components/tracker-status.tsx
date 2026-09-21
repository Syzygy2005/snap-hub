"use client";

import { useEffect, useState } from "react";
import { RelativeTime } from "./relative-time";

export function TrackerStatus({ token }: { token: string }) {
  const [lastUpload, setLastUpload] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (document.visibilityState !== "visible") { timer = setTimeout(check, 15000); return; }
      try {
        const res = await fetch("/api/tracker/status", { headers: { authorization: `Bearer ${token}` }, signal: ctrl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Couldn't check tracker status.");
        if (!ctrl.signal.aborted) { setLastUpload(body.lastUploadAt); setChecked(true); setError(""); }
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : "Couldn't check tracker status.");
      } finally {
        if (!ctrl.signal.aborted) timer = setTimeout(check, 15000);
      }
    };
    void check();
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [token, refresh]);
  return <div className="mt-4 space-y-2 rounded-lg border border-line bg-bg p-3">
    <p role="status" className="font-semibold">{error ? "Status unavailable" : !checked ? "Checking tracker…" : lastUpload ? "Tracker upload received" : "Waiting for your first game"}</p>
    {lastUpload && <p className="text-sm text-muted">Last successful upload: <RelativeTime iso={lastUpload} />. This confirms an upload, not that the tracker is currently running.</p>}
    {error && <p role="alert" className="text-sm text-down">{error}</p>}
    <button type="button" className="text-sm text-accent underline" onClick={() => setRefresh((n) => n + 1)}>Check now</button>
    <details className="text-sm text-muted"><summary className="cursor-pointer">No game showing up?</summary><ul className="mt-2 list-disc space-y-1 pl-5">
      <li>Keep the tracker window open while playing Marvel Snap on Windows.</li>
      <li>Finish a game, then wait a few seconds. Old games cannot be recovered from the file.</li>
      <li>Check the tracker window for a key, folder, or connection error. Use the same key on this page and in the tracker.</li>
    </ul></details>
  </div>;
}
