"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClaimView } from "@/lib/leaderboard/claims";

/**
 * "This is me" on a leaderboard profile.
 *
 * The server sends pending claims only to their claimant and admins. Only admin-confirmed
 * claims are public. This component receives a minimal view, never the underlying record.
 */
export function PlayerClaim({
  playerId,
  playerName,
  claim,
  signedIn,
  mine,
  admin,
}: {
  playerId: number;
  playerName: string;
  claim: ClaimView | null;
  signedIn: boolean;
  mine: boolean;
  admin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (method: "POST" | "DELETE" | "PATCH", confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/claim`, { method });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "That did not work");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work");
    } finally {
      setBusy(false);
    }
  };

  const button = "rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50";

  // Somebody else has it and it is confirmed: a plain credit, no controls.
  if (claim?.verifiedAt && !mine) {
    return (
      <p className="mt-4 text-sm text-muted">
        Claimed by <span className="font-medium text-ink">{claim.username}</span>
        {admin && (
          <button
            type="button"
            onClick={() => call("DELETE", `Remove ${claim.username}'s claim on ${playerName}?`)}
            disabled={busy}
            className="ml-3 text-xs text-down hover:underline disabled:opacity-50"
          >
            remove
          </button>
        )}
      </p>
    );
  }

  // Somebody else has claimed it and nothing has vouched for them yet. Only an admin needs to
  // know that, because until it is confirmed it is just an assertion.
  if (claim && !mine) {
    if (!admin) return null;
    return (
      <div className="mt-4 rounded-xl border border-gem-purple/40 bg-gem-purple/5 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gem-purple">Admin</span>
        <p className="mt-1 text-sm">
          <span className="font-medium">{claim.username}</span> says this is them. Admin confirmation is required.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => call("PATCH")} disabled={busy} className={button}>
            Confirm
          </button>
          <button
            type="button"
            onClick={() => call("DELETE", `Remove ${claim.username}'s claim on ${playerName}?`)}
            disabled={busy}
            className="rounded-md border border-down/50 px-3 py-1.5 text-sm font-medium text-down hover:bg-down/10 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-down">{error}</p>}
      </div>
    );
  }

  if (mine && claim) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-surface/80 px-4 py-3 text-sm">
        {claim.verifiedAt ? (
          <p>
            This profile is yours, shown as <span className="font-medium">{claim.username}</span>.
          </p>
        ) : (
          <p className="text-muted">
            You have claimed this profile. Only you and admins can see your claim until an admin confirms it.
            A matching tracker name does not confirm ownership.
          </p>
        )}
        <button
          type="button"
          onClick={() => call("DELETE", `Release your claim on ${playerName}?`)}
          disabled={busy}
          className="mt-2 text-xs text-faint hover:text-ink disabled:opacity-50"
        >
          Release this claim
        </button>
        {error && <p className="mt-2 text-sm text-down">{error}</p>}
      </div>
    );
  }

  if (!signedIn) return null;

  return (
    <div className="mt-4">
      <button type="button" onClick={() => call("POST")} disabled={busy} className={button}>
        This is me
      </button>
      {error && <p className="mt-2 text-sm text-down">{error}</p>}
    </div>
  );
}
