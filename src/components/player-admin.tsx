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
export function PlayerAdmin({ playerId, playerName }: { playerId: number; playerName: string }) {
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

  return (
    <div className="mt-4 rounded-xl border border-gem-purple/40 bg-gem-purple/5 px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gem-purple">Admin</p>
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
