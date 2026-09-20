import Link from "next/link";
import type { NameSighting } from "@/lib/stats/identity";

/**
 * What the PC tracker has seen the account behind this name call itself.
 *
 * Shown to an admin only, and deliberately read-only. A game file is uploaded by its own
 * client and the Snap account id travels in a header the uploader sets, so anyone with a
 * tracker key could describe an account that is not theirs, including one they only know
 * because they played against them. Applying that to a public player row automatically would
 * hand a stranger the ability to rewrite somebody's history. So this sits next to the merge
 * and rename controls as evidence, and a person decides.
 */
export function TrackerEvidence({ name, sightings }: { name: string; sightings: NameSighting[] }) {
  if (sightings.length === 0) return null;
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

  return (
    <div className="mt-4 rounded-xl border border-gem-purple/40 bg-gem-purple/5 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gem-purple">Admin</span>
        <p className="text-sm text-muted">
          A tracker has seen whoever plays as <span className="text-ink">{name}</span> also use:
        </p>
      </div>

      <ul className="mt-2 space-y-1 text-sm">
        {sightings.map((s) => (
          <li key={s.name} className="flex flex-wrap items-baseline gap-x-2">
            <Link href={`/players?q=${encodeURIComponent(s.name)}`} className="font-medium text-accent hover:underline">
              {s.name}
            </Link>
            <span className="text-xs text-faint">
              {s.games} {s.games === 1 ? "game" : "games"}, {date(s.firstSeen)} to {date(s.lastSeen)}
            </span>
            {!s.signedIn && <span className="text-xs text-down">reported by a key with no account</span>}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-faint">
        Evidence, not proof. A game file comes from the player&rsquo;s own machine, so this says what a
        tracker was told rather than what happened. Use merge above if it matches what the board did.
      </p>
    </div>
  );
}
