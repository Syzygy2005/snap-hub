import Link from "next/link";
import type { LocationRecord } from "@/lib/stats/aggregate";
import { locationName, LOW_SAMPLE, pct } from "./stats-ui";

/**
 * How often each location gets won.
 *
 * The game records that a location was won and never that it was lost, so a lane that is not
 * won covers losing it and tying it alike. The wording says "won" throughout for that reason;
 * calling the rest losses would be inventing a distinction the file does not make.
 */
export function LocationRecordPanel({
  records,
  names = {},
}: {
  records: LocationRecord[];
  names?: Record<string, string>;
}) {
  if (!records.length) {
    return (
      <p className="px-4 py-6 text-sm text-muted">
        Locations show up here once you have played games recorded with their results.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted">
            <th className="w-full px-4 py-2 font-medium">Location</th>
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Seen</th>
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Won</th>
            <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Avg power</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {records.map((r) => (
            <tr key={r.location}>
              <td className="px-4 py-2">
                {names[r.location] ? (
                  <Link
                    className="text-accent hover:underline"
                    href={`/wiki/locations/${encodeURIComponent(r.location)}`}
                  >
                    {names[r.location]}
                  </Link>
                ) : (
                  locationName(r.location)
                )}
              </td>
              <td className="num px-2 py-2 text-right text-muted">{r.games}</td>
              {/* nowrap, or the percentage and the count stack and that row stands half again
                  as tall as the rest, the same way "over a day ago" did on the leaderboard. */}
              <td className="num whitespace-nowrap px-2 py-2 text-right">
                {/* Greyed until there are enough sightings to mean anything, the same threshold
                    the rest of the stats use. Never invent a second one. */}
                <span className={r.games < LOW_SAMPLE ? "text-muted" : "font-semibold"}>
                  {pct(r.winRate, 0)}
                </span>
                <span className="ml-1 text-xs text-faint">
                  ({r.won}/{r.games})
                </span>
              </td>
              <td className="num px-4 py-2 text-right text-muted">
                {r.power === null ? "—" : r.power.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-faint">
        A location counts as won only when the game said so. Anything else covers both losing it
        and tying it, which the game file does not tell apart.
      </p>
    </div>
  );
}
