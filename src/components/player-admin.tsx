"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Plan {
  keep: { id: number; name: string };
  absorb: { id: number; name: string; lastSeen: string };
  historyRows: number;
  seasonsMoved: { season: string; region: string }[];
  seasonsCombined: { season: string; region: string }[];
}

/**
 * Merging two player rows, for a rename the board could not prove on its own. Preview first,
 * then confirm: a mis-typed id is caught by reading the two names back before anything happens.
 */
export function PlayerAdmin({
  playerId,
  playerName,
  formerNames,
}: {
  playerId: number;
  playerName: string;
  formerNames: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [absorbId, setAbsorbId] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (apply: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/merge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ absorbId: Number(absorbId), apply }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string; applied?: boolean; plan?: Plan };
      if (!body.ok) throw new Error(body.error ?? "Could not merge those players");
      if (body.applied) {
        setPlan(null);
        setAbsorbId("");
        router.refresh();
      } else {
        setPlan(body.plan ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not merge those players");
      setPlan(null);
    } finally {
      setBusy(false);
    }
  };

  const dropFormerName = async (nameId: number, name: string) => {
    if (!confirm(`Remove "${name}" from this player's former names?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/names/${nameId}`, { method: "DELETE" });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "Could not remove that name");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that name");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-gem-purple/40 bg-gem-purple/5 px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gem-purple">Admin</p>

      {formerNames.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-sm text-muted">
            Former names. Remove one if the rename never happened; the player and their history stay.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {formerNames.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => dropFormerName(n.id, n.name)}
                  title={`Remove "${n.name}"`}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2 py-1 text-xs text-muted hover:border-down/60 hover:text-down disabled:opacity-50"
                >
                  {n.name}
                  <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden>
                    <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mb-2 text-sm text-muted">
        Merge another player into <strong className="text-ink">{playerName}</strong>, when the two are one person
        under two names. Their id is the number at the end of their profile address.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={absorbId}
          onChange={(e) => {
            setAbsorbId(e.target.value.replace(/\D/g, ""));
            setPlan(null);
          }}
          inputMode="numeric"
          placeholder="Player id to merge in"
          aria-label="Player id to merge in"
          className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-1.5 text-base focus:border-accent focus:outline-none sm:max-w-56 sm:text-sm"
        />
        <button
          type="button"
          onClick={() => call(false)}
          disabled={busy || !absorbId}
          className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50"
        >
          Preview
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-down">{error}</p>}

      {plan && (
        <div className="mt-3 rounded-lg border border-line bg-bg/60 p-3 text-sm">
          <p>
            Keep <strong className="text-ink">{plan.keep.name}</strong> (#{plan.keep.id}) and absorb{" "}
            <strong className="text-ink">{plan.absorb.name}</strong> (#{plan.absorb.id}).
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
            <li>{plan.historyRows} history rows move across</li>
            <li>
              {plan.seasonsCombined.length} season(s) combine
              {plan.seasonsCombined.length > 0 && `: ${plan.seasonsCombined.map((x) => x.season).join(", ")}`}
            </li>
            <li>
              {plan.seasonsMoved.length} season(s) move as is
              {plan.seasonsMoved.length > 0 && `: ${plan.seasonsMoved.map((x) => x.season).join(", ")}`}
            </li>
            <li>&ldquo;{plan.absorb.name}&rdquo; is kept as a former name</li>
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm(`Merge ${plan.absorb.name} into ${plan.keep.name}? This cannot be undone.`)) void call(true);
            }}
            className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-bg hover:bg-accent-strong disabled:opacity-50"
          >
            Merge, this cannot be undone
          </button>
        </div>
      )}
    </div>
  );
}
