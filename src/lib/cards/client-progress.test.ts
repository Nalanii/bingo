import { describe, expect, it } from "vitest";
import type { Square } from "@/lib/firestore/cards";
import { computeClientProgress, isSquareDone } from "./client-progress";

function square(overrides: Partial<Square> & { id: string; position: number }): Square {
  return {
    label: `Square ${overrides.id}`,
    kind: "CHECK",
    goal: 1,
    isFreeSpace: false,
    ...overrides,
  };
}

describe("isSquareDone", () => {
  it("is always done for a free space", () => {
    const sq = square({ id: "a", position: 0, isFreeSpace: true });
    expect(isSquareDone(sq, new Set(), {})).toBe(true);
  });

  it("is done for a CHECK square in the completed set", () => {
    const sq = square({ id: "a", position: 0, kind: "CHECK" });
    expect(isSquareDone(sq, new Set(["a"]), {})).toBe(true);
  });

  it("is not done for a CHECK square not in the completed set", () => {
    const sq = square({ id: "a", position: 0, kind: "CHECK" });
    expect(isSquareDone(sq, new Set(), {})).toBe(false);
  });

  it("is done for a COUNTER square whose count reached its goal", () => {
    const sq = square({ id: "a", position: 0, kind: "COUNTER", goal: 3 });
    expect(isSquareDone(sq, new Set(), { a: 3 })).toBe(true);
  });

  it("is not done for a COUNTER square below its goal", () => {
    const sq = square({ id: "a", position: 0, kind: "COUNTER", goal: 3 });
    expect(isSquareDone(sq, new Set(), { a: 2 })).toBe(false);
  });
});

describe("computeClientProgress", () => {
  it("returns zero counts for an empty square list", () => {
    expect(computeClientProgress([], new Set(), {})).toEqual({ completedCount: 0, totalCount: 0 });
  });

  it("excludes free space from both completed and total counts", () => {
    const squares = [
      square({ id: "free", position: 0, isFreeSpace: true }),
      square({ id: "a", position: 1, kind: "CHECK" }),
    ];
    expect(computeClientProgress(squares, new Set(), {})).toEqual({
      completedCount: 0,
      totalCount: 1,
    });
  });

  it("counts completed CHECK squares and in-progress COUNTER squares correctly", () => {
    const squares = [
      square({ id: "a", position: 0, kind: "CHECK" }),
      square({ id: "b", position: 1, kind: "CHECK" }),
      square({ id: "c", position: 2, kind: "COUNTER", goal: 5 }),
    ];
    const result = computeClientProgress(squares, new Set(["a"]), { c: 5 });
    expect(result).toEqual({ completedCount: 2, totalCount: 3 });
  });
});
