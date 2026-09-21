import { syncState } from "@/lib/wiki/queries";
import type { Kind } from "@/lib/wiki/sync";
export async function ReferenceStatus({ kind }: { kind: Kind }) {
  const state = await syncState(kind);
  const stale = !state || state.stale;
  return <aside className="my-5 rounded-lg border border-line bg-surface/60 p-4 text-xs leading-relaxed text-muted">
    <p>Reference data and artwork: <a className="text-accent underline" href={`https://marvelsnapzone.com/${kind}/`}>Marvel Snap Zone</a>. Checked hourly; changes appear after the source publishes them.</p>
    <p>{state?.succeeded_at ? <>Last successful check: <time dateTime={state.succeeded_at.toISOString()}>{state.succeeded_at.toUTCString()}</time>.</> : "Awaiting the first successful reference import."}</p>
    {(stale || state?.error) && <p className="mt-1 text-accent">Updates are delayed. Showing the last available reference data.</p>}
  </aside>;
}
export { WikiTabs } from "./wiki-tabs";
