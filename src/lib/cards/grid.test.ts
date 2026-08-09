import { describe, expect, it } from "vitest";
import { CARD_GRID_SIZES, isValidGridSize, squareCount } from "./grid";

describe("isValidGridSize", () => {
  it("accepts every size in CARD_GRID_SIZES", () => {
    for (const size of CARD_GRID_SIZES) {
      expect(isValidGridSize(size)).toBe(true);
    }
  });

  it("rejects sizes outside CARD_GRID_SIZES", () => {
    expect(isValidGridSize(4)).toBe(false);
    expect(isValidGridSize(0)).toBe(false);
    expect(isValidGridSize(-3)).toBe(false);
  });
});

describe("squareCount", () => {
  it("counts every square when there's no free space", () => {
    expect(squareCount(3, false)).toBe(9);
    expect(squareCount(5, false)).toBe(25);
  });

  it("subtracts one square when there's a free space", () => {
    expect(squareCount(3, true)).toBe(8);
    expect(squareCount(5, true)).toBe(24);
  });
});
