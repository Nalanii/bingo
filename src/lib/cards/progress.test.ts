import { describe, expect, it } from "vitest";
import { getBingoLines } from "./progress";

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
