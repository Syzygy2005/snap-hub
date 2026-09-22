import { describe, expect, it } from "vitest";
import { cubeDiscipline, type CubeGame } from "./aggregate";

const game = (over: Partial<CubeGame>): CubeGame => ({
  result: "win",
  cubes: 1,
  snapped: false,
  opponentSnapped: false,
  conceded: false,
  opponentConceded: false,
  ...over,
});

describe("cubeDiscipline", () => {
  it("is empty and says so rather than guessing at zero", () => {
    const d = cubeDiscipline([]);
    expect(d.retreatRate).toBeNull();
    expect(d.foldRate).toBeNull();
    expect(d.snapped.winRate).toBeNull();
    expect(d.retreated).toEqual({ games: 0, cubes: 0, perGame: null });
    expect(d.theyFolded).toEqual({ games: 0, cubes: 0, perGame: null });
  });

  it("counts the cubes they handed over by walking away", () => {
    // The mirror of retreating. Recorded on every upload, read by nothing until now.
    const d = cubeDiscipline([
      game({ opponentConceded: true, result: "win", cubes: 4 }),
      game({ opponentConceded: true, result: "win", cubes: 2 }),
      game({ result: "win", cubes: 1 }),
      game({ result: "loss", cubes: -8, conceded: true }),
    ]);
    expect(d.theyFolded).toEqual({ games: 2, cubes: 6, perGame: 3 });
    expect(d.foldRate).toBe(0.5);
    // Your own retreat is a separate fact and must not move with theirs.
    expect(d.retreatRate).toBe(0.25);
    expect(d.retreated).toMatchObject({ games: 1, cubes: 8 });
  });

  it("splits games by who raised the stakes", () => {
    const d = cubeDiscipline([
      game({ snapped: true, result: "win", cubes: 4 }),
      game({ snapped: true, result: "loss", cubes: -4 }),
      game({ opponentSnapped: true, result: "win", cubes: 4 }),
      game({ result: "win", cubes: 1 }),
      game({ result: "loss", cubes: -1 }),
    ]);
    expect(d.snapped).toMatchObject({ games: 2, wins: 1, losses: 1, netCubes: 0 });
    expect(d.calledTheirSnap).toMatchObject({ games: 1, wins: 1, netCubes: 4 });
    expect(d.quiet).toMatchObject({ games: 2, wins: 1, losses: 1, netCubes: 0 });
  });

  it("counts a game where both snapped as yours, not theirs", () => {
    const d = cubeDiscipline([game({ snapped: true, opponentSnapped: true, result: "loss", cubes: -8 })]);
    expect(d.snapped.games).toBe(1);
    expect(d.calledTheirSnap.games).toBe(0);
  });

  it("separates what a retreat costs from what sitting through a loss costs", () => {
    const d = cubeDiscipline([
      game({ result: "loss", cubes: -1, conceded: true }),
      game({ result: "loss", cubes: -2, conceded: true }),
      game({ result: "loss", cubes: -8 }),
      game({ result: "loss", cubes: -4 }),
      game({ result: "win", cubes: 2 }),
    ]);
    expect(d.retreated).toEqual({ games: 2, cubes: 3, perGame: 1.5 });
    expect(d.playedOut).toEqual({ games: 2, cubes: 12, perGame: 6 });
    expect(d.retreatRate).toBe(0.4);
  });

  it("reports cubes given up as a positive number", () => {
    const d = cubeDiscipline([game({ result: "loss", cubes: -6, conceded: true })]);
    expect(d.retreated.cubes).toBe(6);
  });

  it("keeps wins and ties out of the bleed numbers", () => {
    const d = cubeDiscipline([
      game({ result: "win", cubes: 4, conceded: false }),
      game({ result: "tie", cubes: 0 }),
    ]);
    expect(d.retreated.games).toBe(0);
    expect(d.playedOut.games).toBe(0);
  });
});
