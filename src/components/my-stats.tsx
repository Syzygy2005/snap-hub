"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { PersonalStats } from "@/lib/stats/queries";
import type { LinkedTracker as Linked } from "@/lib/stats/tracker";
import { forgetTrackerKey, loadTrackerKey, saveTrackerKey } from "@/lib/stats/client-key";
import { encodeDeck } from "@/lib/decks/code";
import { formatRelative, useNow } from "./relative-time";
import { BoardView, CardStrip, CubeRate, pct, ResultBadge, signed, WinRate } from "./stats-ui";
import { EmptyState, Panel, Stat } from "./ui";

type Window = "7d" | "30d" | "all";
const WINDOWS: { key: Window; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

const subscribeNoop = () => () => {};

export function MyStats() {
  const storedKey = useSyncExternalStore(subscribeNoop, loadTrackerKey, () => null);
  const [key, setKey] = useState<string | null>(null);
  const activeKey = key ?? storedKey;
  const [window, setWindow] = useState<Window>("30d");
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [openBoard, setOpenBoard] = useState<number | null>(null);
  const [account, setAccount] = useState<{ signedIn: boolean; trackers: Linked[]; heldKeyLinked: boolean | null }>({
    signedIn: false,
    trackers: [],
    heldKeyLinked: null,
  });
  const [linking, setLinking] = useState(false);
  const now = useNow();

  // The key still goes along when this browser has one: signed in the server ignores it for
  // whose stats to show and only reports whether it is already on the account.
  const load = useCallback(async (token: string | null, w: Window, signal?: AbortSignal) => {
    const res = await fetch(`/api/tracker/me?window=${w}`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      signal,
    });
    const body = (await res.json()) as {
      ok: boolean;
      stats?: PersonalStats;
      error?: string;
      signedIn?: boolean;
      trackers?: Linked[];
      heldKeyLinked?: boolean | null;
    };
    if (!body.ok || !body.stats) {
      throw new Error(res.status === 401 ? "That key wasn't recognised." : body.error ?? "Couldn't load stats");
    }
    return body;
  }, []);

  const refresh = useCallback(
    (signal?: AbortSignal) =>
      load(activeKey, window, signal)
        .then((body) => {
          setStats(body.stats!);
          setAccount({
            signedIn: !!body.signedIn,
            trackers: body.trackers ?? [],
            heldKeyLinked: body.heldKeyLinked ?? null,
          });
          setError(null);
        })
        .catch((err: unknown) => {
          if (!signal?.aborted) setError(err instanceof Error ? err.message : "Couldn't load stats");
        }),
    [activeKey, window, load],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void refresh(ctrl.signal);
    return () => ctrl.abort();
  }, [refresh]);

  const linkHeldKey = async () => {
    if (!activeKey) return;
    setLinking(true);
    try {
      const res = await fetch("/api/tracker/claim", {
        method: "POST",
        headers: { authorization: `Bearer ${activeKey}` },
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "Could not add that key");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that key");
    } finally {
      setLinking(false);
    }
  };

  // Signed in with no key in this browser is a normal, working state: the account's own keys
  // are what the stats come from, so don't demand a paste.
  if ((!activeKey && !account.signedIn && !stats) || (error && !stats)) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        {error && <p className="rounded-md border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const token = draft.trim();
            if (!token) return;
            saveTrackerKey(token);
            setError(null);
            setStats(null);
            setKey(token);
          }}
          className="space-y-3 rounded-xl border border-line bg-surface p-5"
        >
          <p className="text-sm text-muted">
            Paste your tracker key to see your stats. Don&apos;t have one?{" "}
            <Link href="/stats/tracker" className="text-accent hover:underline">
              Set up the tracker
            </Link>
            .
          </p>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="shk_…"
            aria-label="Tracker key"
            className="w-full rounded-md border border-line bg-bg px-3 py-2 font-mono text-base focus:border-accent focus:outline-none sm:text-sm"
          />
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-strong">Show my stats</button>
        </form>
      </div>
    );
  }

  if (!stats) return <p className="py-10 text-center text-sm text-muted">Loading your games…</p>;

  const s = stats.summary;

  return (
    <div className="space-y-6">
      {account.signedIn && activeKey && account.heldKeyLinked === false && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
          <p className="min-w-0 text-sm">
            This browser has a tracker key that isn&apos;t on your account yet. Add it and its games follow you
            wherever you sign in.
          </p>
          <button
            type="button"
            onClick={linkHeldKey}
            disabled={linking}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-bg hover:bg-accent-strong disabled:opacity-50"
          >
            {linking ? "Adding…" : "Add to my account"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {account.signedIn ? (
            <>
              Signed in as <strong className="text-ink">{stats.tracker.name}</strong>
              {account.trackers.length > 0 && (
                <>
                  {" · "}
                  {account.trackers.length} tracker key{account.trackers.length === 1 ? "" : "s"}
                </>
              )}
            </>
          ) : (
            <>
              Signed in with the key for <strong className="text-ink">{stats.tracker.name}</strong>
            </>
          )}
        </p>
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm" role="group" aria-label="Time range">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setWindow(w.key)}
              aria-pressed={window === w.key}
              className={`rounded-md px-3 py-1 font-medium ${window === w.key ? "bg-accent text-bg" : "text-muted hover:text-ink"}`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {s.games === 0 ? (
        <EmptyState title="No games yet">
          Run the tracker while you play on PC and your games will show up here.{" "}
          <Link href="/stats/tracker" className="text-accent hover:underline">
            Tracker setup
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Games" value={s.games} hint={`${s.wins}W · ${s.losses}L · ${s.ties}T`} />
            <Stat label="Win rate" value={<WinRate value={s.winRate} games={s.games} />} hint="ties not counted" />
            <Stat label="Cube rate" value={<CubeRate value={s.cubeRate} games={s.games} />} hint="net cubes per game" />
            <Stat
              label="Net cubes"
              value={<span className={s.netCubes >= 0 ? "text-up" : "text-down"}>{signed(s.netCubes, 0)}</span>}
            />
          </div>

          <Panel title="Cubes over time">
            <CubesChart points={stats.cubesOverTime} />
          </Panel>

          <Panel title="Your decks">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                    <th className="px-4 py-2 font-medium">Deck</th>
                    <th className="px-2 py-2 text-right font-medium">Games</th>
                    <th className="px-2 py-2 text-right font-medium">Win rate</th>
                    <th className="px-2 py-2 text-right font-medium">Cube rate</th>
                    <th className="px-4 py-2 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {stats.decks.map((d) => (
                    <tr key={d.key} className="border-t border-line/60">
                      <td className="px-4 py-2">
                        <div className="font-semibold">{d.name}</div>
                        <CardStrip ids={d.cards} info={stats.cardInfo} className="mt-1" />
                      </td>
                      <td className="num px-2 py-2 text-right">{d.games}</td>
                      <td className="px-2 py-2 text-right">
                        <WinRate value={d.winRate} games={d.games} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <CubeRate value={d.cubeRate} games={d.games} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/decks/builder?code=${encodeURIComponent(encodeDeck(d.cards, d.name))}`}
                          className="text-xs font-semibold text-accent hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Recent games">
            <ul>
              {stats.recent.map((g) => (
                <li key={g.id} className="border-t border-line/60 first:border-t-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm">
                    <ResultBadge result={g.result} />
                    <span className={`num w-10 font-bold ${g.cubes > 0 ? "text-up" : g.cubes < 0 ? "text-down" : "text-muted"}`}>
                      {signed(g.cubes, 0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{g.deckName ?? "Deck"}</span>
                      {g.opponentName && <span className="text-muted"> vs {g.opponentName}</span>}
                      <span className="block text-xs text-faint">
                        {[
                          g.league,
                          g.turns ? `${g.turns} turns` : null,
                          g.snapped ? "you snapped" : null,
                          g.opponentSnapped ? "they snapped" : null,
                          now === null ? null : formatRelative(g.playedAt, now),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {(g.opponentCards.length > 0 || g.board.length > 0) && (
                      // Its own row on a phone, otherwise it squeezes the deck name and
                      // match details into a one-word-per-line column.
                      <span className="flex basis-full items-center gap-2 sm:basis-auto">
                        {g.opponentCards.length > 0 && (
                          <>
                            <span className="text-[11px] uppercase tracking-wider text-faint">They showed</span>
                            <CardStrip ids={g.opponentCards} info={stats.cardInfo} max={8} />
                          </>
                        )}
                        {g.board.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setOpenBoard((o) => (o === g.id ? null : g.id))}
                            aria-expanded={openBoard === g.id}
                            className="ml-auto rounded-md border border-line px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted hover:border-accent/60 hover:text-ink sm:ml-0"
                          >
                            Board
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  {openBoard === g.id && (
                    <div className="border-t border-line/40 px-4 py-3">
                      <BoardView zones={g.board} info={stats.cardInfo} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      <div className="flex flex-wrap gap-3 border-t border-line pt-4 text-xs">
        <button
          type="button"
          onClick={() => {
            forgetTrackerKey();
            setKey(null);
            setStats(null);
            location.reload();
          }}
          className="text-muted hover:text-ink"
        >
          Forget my key on this browser
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Delete your tracker key and every game it uploaded? This can't be undone.")) return;
            const res = await fetch("/api/tracker/me", { method: "DELETE", headers: { authorization: `Bearer ${activeKey}` } });
            if (res.ok) {
              forgetTrackerKey();
              location.reload();
            } else {
              setError("Couldn't delete your data. Try again.");
            }
          }}
          className="text-down/80 hover:text-down"
        >
          Delete my key and all my games
        </button>
        <span className="text-faint">Win rate {pct(s.winRate)} over {s.games} games.</span>
      </div>
    </div>
  );
}

function CubesChart({ points }: { points: { at: string; total: number }[] }) {
  if (points.length < 2) {
    return <p className="px-4 py-8 text-center text-sm text-muted">The chart appears after a couple of games.</p>;
  }
  const W = 1000;
  const H = 220;
  const values = [0, ...points.map((p) => p.total)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / points.length) * W;
  const y = (v: number) => H - 10 - ((v - min) / span) * (H - 20);
  const path = `M0 ${y(0)} ` + points.map((p, i) => `L${x(i + 1).toFixed(1)} ${y(p.total).toFixed(1)}`).join(" ");
  const last = points.at(-1)!.total;

  return (
    <div className="px-4 py-4">
      <div className="mb-2 flex justify-between text-xs text-muted">
        <span>
          Best <span className="num text-up">{signed(max, 0)}</span> · Worst <span className="num text-down">{signed(min, 0)}</span>
        </span>
        <span>
          Now <span className={`num font-semibold ${last >= 0 ? "text-up" : "text-down"}`}>{signed(last, 0)}</span> over{" "}
          {points.length} games
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-48 w-full" role="img" aria-label="Net cubes after each game">
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-line)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        <path d={`${path} L${W} ${y(0)} Z`} fill="var(--color-accent)" opacity={0.08} />
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
