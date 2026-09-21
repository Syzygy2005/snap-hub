import type { CubeDiscipline } from "@/lib/stats/aggregate";
import { CubeRate, LOW_SAMPLE, pct, WinRate } from "./stats-ui";

/**
 * Where the cubes go, rather than how often you win.
 *
 * Win rate is the wrong headline for this game: you can win most of your matches and still
 * finish down, because the cubes move when somebody raises and when somebody walks away.
 * All of this was already on every uploaded game and none of it was being read.
 */
export function CubeDisciplinePanel({ cubes }: { cubes: CubeDiscipline }) {
  const rows = [
    { label: "You snapped", s: cubes.snapped, hint: "you raised the stakes" },
    { label: "You called theirs", s: cubes.calledTheirSnap, hint: "they raised, you stayed in" },
    { label: "Nobody snapped", s: cubes.quiet, hint: "the baseline to read the others against" },
  ];

  const { retreated, playedOut } = cubes;
  // Only worth drawing a conclusion when both sides have enough games to mean anything.
  const comparable =
    retreated.perGame !== null &&
    playedOut.perGame !== null &&
    retreated.games >= LOW_SAMPLE &&
    playedOut.games >= LOW_SAMPLE;
  const costOfStaying = comparable ? playedOut.perGame! - retreated.perGame! : null;

  return (
    <div className="space-y-3 px-4 py-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted">
            <th className="pb-2 font-medium">Stakes</th>
            <th className="pb-2 text-right font-medium">Games</th>
            <th className="pb-2 text-right font-medium">Win rate</th>
            <th className="pb-2 text-right font-medium">Cube rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-2">
                <div className="font-medium">{r.label}</div>
                <div className="text-xs text-faint">{r.hint}</div>
              </td>
              <td className="num py-2 text-right text-muted">{r.s.games}</td>
              <td className="num py-2 text-right">
                <WinRate value={r.s.winRate} games={r.s.games} />
              </td>
              <td className="num py-2 text-right">
                <CubeRate value={r.s.cubeRate} games={r.s.games} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-3 sm:grid-cols-2">
        <Bleed
          label="When you retreat"
          games={retreated.games}
          perGame={retreated.perGame}
          hint={`${pct(cubes.retreatRate, 0)} of your games`}
        />
        <Bleed
          label="When you play a loss out"
          games={playedOut.games}
          perGame={playedOut.perGame}
          hint="losses you did not retreat from"
        />
      </div>

      {costOfStaying !== null && costOfStaying > 0 && (
        <p className="text-sm text-muted">
          Sitting through a loss costs you{" "}
          <span className="num font-semibold text-down">{costOfStaying.toFixed(1)}</span> more cubes than
          retreating does.
        </p>
      )}
      {!comparable && (
        <p className="text-xs text-faint">
          {thin(retreated.games, playedOut.games)}
        </p>
      )}
    </div>
  );
}

/**
 * Says which side is short rather than "play more games".
 *
 * Somebody who never retreats is exactly the person this panel is for, and they are also the
 * slowest to collect retreats, so the wait deserves an explanation rather than a shrug.
 */
function thin(retreats: number, playedOut: number): string {
  if (retreats < LOW_SAMPLE && playedOut < LOW_SAMPLE) {
    return "Once there are more games either way, these two costs get compared directly.";
  }
  if (retreats < LOW_SAMPLE) {
    return `Only ${retreats} retreat${retreats === 1 ? "" : "s"} so far, so the two are worth reading side by side rather than compared.`;
  }
  return `Only ${playedOut} loss${playedOut === 1 ? "" : "es"} played out so far, so the two are worth reading side by side rather than compared.`;
}

function Bleed({
  label,
  games,
  perGame,
  hint,
}: {
  label: string;
  games: number;
  perGame: number | null;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface/80 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="num mt-1 font-display text-2xl font-bold leading-tight">
        {perGame === null ? (
          <span className="text-muted">—</span>
        ) : (
          <>
            <span className={games < LOW_SAMPLE ? "text-muted" : "text-down"}>−{perGame.toFixed(1)}</span>
            <span className="ml-1 text-sm font-medium text-faint">cubes each</span>
          </>
        )}
      </div>
      <div className="mt-0.5 text-xs text-faint">
        {games} {games === 1 ? "game" : "games"} · {hint}
      </div>
    </div>
  );
}
