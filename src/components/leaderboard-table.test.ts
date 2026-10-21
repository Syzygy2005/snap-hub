import { describe, expect, it } from "vitest";
import type { BoardRow } from "@/lib/leaderboard/queries";
import { initialLimit } from "./leaderboard-table";

const board = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: 1000 + i, rank: i + 1 }) as BoardRow);

describe("initialLimit", () => {
  const rows = board(1000);

  it("shows the first page when the board was not opened at anyone", () => {
    expect(initialLimit(rows, null)).toBe(100);
    expect(initialLimit(rows, 42)).toBe(100);
  });

  it("shows whole pages down to the player's row and the ten rows below it", () => {
    expect(initialLimit(rows, 1000)).toBe(100); // rank 1
    expect(initialLimit(rows, 1000 + 89)).toBe(100); // rank 90: ranks 91 to 100 are below it
    expect(initialLimit(rows, 1000 + 90)).toBe(200); // rank 91: the next page holds the rows below
    expect(initialLimit(rows, 1000 + 733)).toBe(800);
    expect(initialLimit(rows, 1000 + 999)).toBe(1100); // the last row: only 1000 exist, all shown
  });
});
