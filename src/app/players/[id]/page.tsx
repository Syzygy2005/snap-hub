import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HistoryChart } from "@/components/history-chart";
import { RelativeTime } from "@/components/relative-time";
import { PageHeader, Panel, Stat, Tabs } from "@/components/ui";
import { PlayerAdmin } from "@/components/player-admin";
import { isAdmin } from "@/lib/auth/admin";
import { currentAccount } from "@/lib/auth/session";
import { isRegion, REGION_LABELS } from "@/lib/config";
import { param } from "@/lib/leaderboard/params";
import { getPlayer, getPlayerHistory } from "@/lib/leaderboard/queries";
import { seasonLabel } from "@/lib/season";

export const dynamic = "force-dynamic";

async function load(idParam: string) {
  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return getPlayer(id);
}

export async function generateMetadata(props: PageProps<"/players/[id]">): Promise<Metadata> {
  const player = await load((await props.params).id);
  return { title: player ? player.name.trim() : "Player not found" };
}

export default async function PlayerPage(props: PageProps<"/players/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const [player, account] = await Promise.all([load(id), currentAccount()]);
  if (!player) notFound();
  const admin = isAdmin(account);

  if (player.seasons.length === 0) {
    return (
      <>
        <PageHeader title={player.name.trim()} subtitle="No leaderboard appearances recorded." />
        {admin && <PlayerAdmin playerId={player.id} playerName={player.name} />}
      </>
    );
  }

  const seasonParam = param(sp, "season");
  const regionParam = param(sp, "region");
  const selected =
    player.seasons.find((s) => s.season === seasonParam && (!isRegion(regionParam) || s.region === regionParam)) ??
    player.seasons[0];

  const history = await getPlayerHistory(player.id, selected.season, selected.region);
  const rankChanges = history.filter((h, i) => i === 0 || h.score !== history[i - 1].score || h.rank === null).reverse();

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/leaderboard" className="text-muted hover:text-ink">
          ← Leaderboard
        </Link>
      </div>
      <PageHeader
        title={player.name.trim() || "(blank name)"}
        subtitle={
          <>
            First seen <RelativeTime iso={player.firstSeen} /> · last on a board <RelativeTime iso={player.lastSeen} />
            {player.formerNames.length > 0 && (
              <span className="mt-1 block text-xs text-muted">
                Previously{" "}
                {player.formerNames.map((n, i) => (
                  <span key={`${n.name}-${n.changedAt}`}>
                    {i > 0 && ", "}
                    <strong className="font-medium text-ink">{n.name}</strong>{" "}
                    <span className="text-faint">
                      (until <RelativeTime iso={n.changedAt} />)
                    </span>
                  </span>
                ))}
              </span>
            )}
            {player.sameNameCount > 0 && (
              <span className="mt-1 block text-xs text-faint">
                {player.sameNameCount} other tracked player{player.sameNameCount === 1 ? " uses" : "s use"} this name.{" "}
                <Link href={`/players?q=${encodeURIComponent(player.name)}`} className="text-accent hover:underline">
                  See all
                </Link>
              </span>
            )}
          </>
        }
      >
        {player.seasons.length > 1 && (
          <Tabs
            items={player.seasons.slice(0, 8).map((s) => ({
              href: `/players/${player.id}?season=${s.season}${s.region !== "global" ? `&region=${s.region}` : ""}`,
              label: `${seasonLabel(s.season).replace(/ \d{4}$/, "")}${s.region !== "global" ? ` · ${REGION_LABELS[s.region]}` : ""}`,
              active: s === selected,
            }))}
          />
        )}
      </PageHeader>

      {admin && <PlayerAdmin playerId={player.id} playerName={player.name} />}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={selected.onBoard ? "Current rank" : "Last rank"}
          value={`#${selected.rank}`}
          hint={selected.onBoard ? `${seasonLabel(selected.season)}` : "no longer in the top 1000"}
        />
        <Stat label="Points" value={<span className="text-gold">{selected.score.toLocaleString()}</span>} />
        <Stat label="Best rank" value={`#${selected.bestRank}`} hint={seasonLabel(selected.season)} />
        <Stat label="Peak points" value={selected.peakScore.toLocaleString()} />
      </div>

      <Panel title="Rank history" className="mb-6 overflow-hidden">
        <HistoryChart points={history} endAt={selected.updatedAt} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Point changes">
          {rankChanges.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No changes recorded.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto scroll-thin">
              {rankChanges.map((h, i) => {
                const older = rankChanges[i + 1];
                const diff = older ? h.score - older.score : 0;
                return (
                  <li key={h.at + i} className="flex items-center gap-3 border-t border-line/60 px-4 py-2 text-sm first:border-t-0">
                    <span className="w-32 shrink-0 text-xs text-muted">
                      <RelativeTime iso={h.at} />
                    </span>
                    <span className="num flex-1">{h.rank === null ? <span className="text-faint">left the board</span> : `#${h.rank}`}</span>
                    {diff !== 0 && (
                      <span className={`num text-xs ${diff > 0 ? "text-up" : "text-down"}`}>
                        {diff > 0 ? "+" : "−"}
                        {Math.abs(diff)}
                      </span>
                    )}
                    <span className="num w-16 text-right font-semibold text-gold">{h.score.toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Seasons">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 font-medium">Season</th>
                <th className="px-2 py-2 text-right font-medium">Rank</th>
                <th className="px-2 py-2 text-right font-medium">Best</th>
                <th className="px-4 py-2 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {player.seasons.map((s) => (
                <tr key={`${s.season}-${s.region}`} className="border-t border-line/60">
                  <td className="px-4 py-2">
                    <Link
                      href={`/players/${player.id}?season=${s.season}${s.region !== "global" ? `&region=${s.region}` : ""}`}
                      className="hover:text-accent"
                    >
                      {seasonLabel(s.season)}
                    </Link>
                    {s.region !== "global" && <span className="ml-1 text-xs text-muted">{REGION_LABELS[s.region]}</span>}
                  </td>
                  <td className="num px-2 py-2 text-right">#{s.rank}</td>
                  <td className="num px-2 py-2 text-right text-muted">#{s.bestRank}</td>
                  <td className="num px-4 py-2 text-right font-semibold text-gold">{s.score.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
