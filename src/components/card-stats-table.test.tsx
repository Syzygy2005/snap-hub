// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CardStatsTable } from "./card-stats-table";
import type { CardStat } from "@/lib/stats/aggregate";

it("announces the sorted column and keeps its highlight aligned with the sorted rows", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  const card = (defId: string, games: number, winRate: number): CardStat => ({
    defId, games, winRate, playRate: .5, cubeRate: 0, drawnGames: games, drawnWinRate: winRate, playedGames: games, playedWinRate: winRate,
  });
  try {
    act(() => root.render(<CardStatsTable stats={[card("Most games", 50, .4), card("Best rate", 25, .8)]} info={{}} />));
    expect(host.querySelector("tbody tr")?.textContent).toContain("Most games");
    expect(host.querySelector('th[aria-sort="descending"]')?.textContent).toContain("Games");
    const sortButton = Array.from(host.querySelectorAll("th button")).find((b) => b.textContent?.includes("Deck WR"))!;
    act(() => sortButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.querySelector("tbody tr")?.textContent).toContain("Best rate");
    expect(host.querySelector("table")?.dataset.sort).toBe("winRate");
    expect(host.querySelectorAll("th[aria-sort]")).toHaveLength(1);
    expect(host.querySelector('th[aria-sort="descending"]')?.textContent).toContain("Deck WR");
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
