import { describe, expect, it } from "vitest";
import type { Square } from "@/lib/firestore/cards";
import type { Completion } from "@/lib/firestore/completions";
import { computeCardProgress, countCompletionsBySquare, getBingoLines } from "./progress";

function completion(squareId: string): Completion {
  return { id: `completion-${squareId}-${Math.random()}`, squareId, completedAt: new Date() };
}

function square(overrides: Partial<Square> & { id: string; position: number }): Square {
  return {
    label: `Square ${overrides.id}`,
    kind: "CHECK",
    goal: 1,
    isFreeSpace: false,
    ...overrides,
  };
}

function doneMap(positions: number[]): Map<number, boolean> {
  return new Map(positions.map((position) => [position, true]));
}

describe("getBingoLines", () => {
  it("returns an empty array when no lines are complete", () => {
    const done = doneMap([0, 1, 3]); // partial top row + one extra, 3x3 grid
    expect(getBingoLines(3, done)).toEqual([]);
  });

  it("detects a completed row", () => {
    const done = doneMap([3, 4, 5]); // middle row of a 3x3 grid
    expect(getBingoLines(3, done)).toEqual([{ type: "row", index: 1 }]);
  });

  it("detects a completed column", () => {
    const done = doneMap([1, 4, 7]); // middle column of a 3x3 grid
    expect(getBingoLines(3, done)).toEqual([{ type: "column", index: 1 }]);
  });

  it("detects the main diagonal", () => {
    const done = doneMap([0, 4, 8]); // top-left to bottom-right, 3x3 grid
    expect(getBingoLines(3, done)).toEqual([{ type: "diagonal", index: 0 }]);
  });

  it("detects the anti-diagonal", () => {
    const done = doneMap([2, 4, 6]); // top-right to bottom-left, 3x3 grid
    expect(getBingoLines(3, done)).toEqual([{ type: "diagonal", index: 1 }]);
  });

  it("detects multiple simultaneous lines", () => {
    // Full 3x3 grid: every row, column, and both diagonals are complete.
    const done = doneMap([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(getBingoLines(3, done)).toEqual([
      { type: "row", index: 0 },
      { type: "row", index: 1 },
      { type: "row", index: 2 },
      { type: "column", index: 0 },
      { type: "column", index: 1 },
      { type: "column", index: 2 },
      { type: "diagonal", index: 0 },
      { type: "diagonal", index: 1 },
    ]);
  });

  it("works on a 5x5 grid", () => {
    const done = doneMap([0, 5, 10, 15, 20]); // left column of a 5x5 grid
    expect(getBingoLines(5, done)).toEqual([{ type: "column", index: 0 }]);
  });

  it("treats missing positions as not done", () => {
    const done = new Map<number, boolean>(); // empty map, 3x3 grid
    expect(getBingoLines(3, done)).toEqual([]);
  });
});

describe("countCompletionsBySquare", () => {
  it("returns an empty object for no completions", () => {
    expect(countCompletionsBySquare([])).toEqual({});
  });

  it("tallies one completion per square", () => {
    const completions = [completion("a"), completion("b")];
    expect(countCompletionsBySquare(completions)).toEqual({ a: 1, b: 1 });
  });

  it("counts repeated completions for the same square", () => {
    const completions = [completion("a"), completion("a"), completion("b"), completion("a")];
    expect(countCompletionsBySquare(completions)).toEqual({ a: 3, b: 1 });
  });
});

describe("computeCardProgress", () => {
  it("behaves exactly like binary completion for CHECK-only boards", () => {
    const squares = [
      square({ id: "a", position: 0, kind: "CHECK" }),
      square({ id: "b", position: 1, kind: "CHECK" }),
    ];
    const result = computeCardProgress(2, squares, [completion("a")]);
    expect(result.completedCount).toBe(1);
    expect(result.totalCount).toBe(2);
  });

  it("gives fractional credit for an in-progress COUNTER square", () => {
    const squares = [square({ id: "a", position: 0, kind: "COUNTER", goal: 10 })];
    const completions = Array.from({ length: 7 }, () => completion("a"));
    const result = computeCardProgress(2, squares, completions);
    expect(result.completedCount).toBeCloseTo(0.7);
    expect(result.totalCount).toBe(1);
  });

  it("caps a COUNTER square's credit at 1 even past its goal", () => {
    const squares = [square({ id: "a", position: 0, kind: "COUNTER", goal: 3 })];
    const completions = Array.from({ length: 5 }, () => completion("a"));
    const result = computeCardProgress(2, squares, completions);
    expect(result.completedCount).toBe(1);
  });

  it("excludes the free space from completed and total counts", () => {
    const squares = [
      square({ id: "free", position: 0, isFreeSpace: true }),
      square({ id: "a", position: 1, kind: "CHECK" }),
    ];
    const result = computeCardProgress(2, squares, []);
    expect(result).toMatchObject({ completedCount: 0, totalCount: 1 });
  });

  it("does not award a bingo line for a COUNTER square short of its goal", () => {
    // 2x2 grid, top row = squares a (COUNTER, 7/10) and b (CHECK, done).
    const squares = [
      square({ id: "a", position: 0, kind: "COUNTER", goal: 10 }),
      square({ id: "b", position: 1, kind: "CHECK" }),
      square({ id: "c", position: 2, kind: "CHECK" }),
      square({ id: "d", position: 3, kind: "CHECK" }),
    ];
    const completions = [...Array.from({ length: 7 }, () => completion("a")), completion("b")];
    const result = computeCardProgress(2, squares, completions);
    expect(result.hasBingo).toBe(false);
    expect(result.isBlackout).toBe(false);
  });

  it("only registers a blackout once every COUNTER square hits its full goal", () => {
    const squares = [square({ id: "a", position: 0, kind: "COUNTER", goal: 10 })];
    const shortOfGoal = computeCardProgress(1, squares, Array.from({ length: 9 }, () => completion("a")));
    expect(shortOfGoal.isBlackout).toBe(false);

    const atGoal = computeCardProgress(1, squares, Array.from({ length: 10 }, () => completion("a")));
    expect(atGoal.isBlackout).toBe(true);
  });
});
