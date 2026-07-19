import type { Square } from "@/lib/firestore/cards";
import type { Completion } from "@/lib/firestore/completions";

export interface CardProgress {
  completedCount: number;
  totalCount: number;
  hasBingo: boolean;
}

/** A square is done when it's the free space or its completion count reaches its goal (CHECK squares have goal 1). */
function isSquareDone(square: Square, count: number): boolean {
  return square.isFreeSpace || count >= square.goal;
}

export type BingoLineType = "row" | "column" | "diagonal";

export interface BingoLine {
  type: BingoLineType;
  /** Row/column index for row/column lines; 0 = main diagonal, 1 = anti-diagonal for diagonal lines. */
  index: number;
}

/**
 * Returns every completed row, column, and diagonal for a grid, using row-major
 * positions (matches freeSpacePosition's layout: position = row * gridSize + col).
 */
export function getBingoLines(gridSize: number, doneByPosition: Map<number, boolean>): BingoLine[] {
  const isDone = (row: number, col: number) => doneByPosition.get(row * gridSize + col) ?? false;
  const lines: BingoLine[] = [];

  for (let row = 0; row < gridSize; row++) {
    if (Array.from({ length: gridSize }, (_, col) => isDone(row, col)).every(Boolean)) {
      lines.push({ type: "row", index: row });
    }
  }
  for (let col = 0; col < gridSize; col++) {
    if (Array.from({ length: gridSize }, (_, row) => isDone(row, col)).every(Boolean)) {
      lines.push({ type: "column", index: col });
    }
  }
  if (Array.from({ length: gridSize }, (_, i) => isDone(i, i)).every(Boolean)) {
    lines.push({ type: "diagonal", index: 0 });
  }
  if (Array.from({ length: gridSize }, (_, i) => isDone(i, gridSize - 1 - i)).every(Boolean)) {
    lines.push({ type: "diagonal", index: 1 });
  }

  return lines;
}

/** Computes how many of a card's squares are done and whether a bingo line is complete. */
export function computeCardProgress(
  gridSize: number,
  squares: Square[],
  completions: Completion[],
): CardProgress {
  const countsBySquareId = completions.reduce<Record<string, number>>((counts, completion) => {
    counts[completion.squareId] = (counts[completion.squareId] ?? 0) + 1;
    return counts;
  }, {});

  const doneByPosition = new Map<number, boolean>();
  let completedCount = 0;
  for (const square of squares) {
    const done = isSquareDone(square, countsBySquareId[square.id] ?? 0);
    if (done) completedCount += 1;
    doneByPosition.set(square.position, done);
  }

  return {
    completedCount,
    totalCount: squares.length,
    hasBingo: getBingoLines(gridSize, doneByPosition).length > 0,
  };
}
