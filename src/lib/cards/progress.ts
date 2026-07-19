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

/** Whether any full row, column, or diagonal is done, using row-major positions (matches freeSpacePosition's layout). */
function hasBingoLine(gridSize: number, doneByPosition: Map<number, boolean>): boolean {
  const isDone = (row: number, col: number) => doneByPosition.get(row * gridSize + col) ?? false;

  for (let row = 0; row < gridSize; row++) {
    if (Array.from({ length: gridSize }, (_, col) => isDone(row, col)).every(Boolean)) return true;
  }
  for (let col = 0; col < gridSize; col++) {
    if (Array.from({ length: gridSize }, (_, row) => isDone(row, col)).every(Boolean)) return true;
  }
  if (Array.from({ length: gridSize }, (_, i) => isDone(i, i)).every(Boolean)) return true;
  if (Array.from({ length: gridSize }, (_, i) => isDone(i, gridSize - 1 - i)).every(Boolean)) {
    return true;
  }

  return false;
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
    hasBingo: hasBingoLine(gridSize, doneByPosition),
  };
}
