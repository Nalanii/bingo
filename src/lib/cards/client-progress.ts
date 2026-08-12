import type { Square } from "@/lib/firestore/cards";

/**
 * A square is done when it's the free space, its counter reached goal, or (for CHECK
 * squares) it's in the completed set. This mirrors (but isn't the same as) the
 * `isSquareDone` in `src/lib/cards/progress.ts` — that version derives done-ness from
 * completion counts, while this one reads client-side `completedSquareIds`/`counts`
 * state directly, since CHECK-square toggles here don't update `counts`.
 */
export function isSquareDone(
  square: Square,
  completedSquareIds: Set<string>,
  counts: Record<string, number>,
): boolean {
  if (square.isFreeSpace) return true;
  if (square.kind === "COUNTER") return (counts[square.id] ?? 0) >= square.goal;
  return completedSquareIds.has(square.id);
}

export interface ClientProgress {
  /**
   * Sum of per-square progress credit (0–1 each), not a whole-square count — a
   * COUNTER square at 7/10 contributes 0.7. Free space is excluded, same as `totalCount`.
   */
  completedCount: number;
  totalCount: number;
}

/**
 * Fractional progress credit for a non-free-space square: 1 for a completed
 * CHECK square, `min(count / goal, 1)` for a COUNTER square (so a square at
 * 7/10 contributes 0.7). Mirrors `squareCredit` in `src/lib/cards/progress.ts`
 * but reads client-side toggle state directly, for the same reason `isSquareDone` above does.
 */
function squareCredit(square: Square, completedSquareIds: Set<string>, counts: Record<string, number>): number {
  if (square.kind === "COUNTER") return Math.min((counts[square.id] ?? 0) / square.goal, 1);
  return completedSquareIds.has(square.id) ? 1 : 0;
}

/**
 * Live completed/total counts for the play view's progress bar. Mirrors
 * `computeCardProgress` in `src/lib/cards/progress.ts` (free space excluded
 * from both counts) but reads client-side toggle state directly instead of
 * refetched completion docs, for the same reason `isSquareDone` above does.
 */
export function computeClientProgress(
  squares: Square[],
  completedSquareIds: Set<string>,
  counts: Record<string, number>,
): ClientProgress {
  let completedCount = 0;
  let totalCount = 0;
  for (const square of squares) {
    if (square.isFreeSpace) continue;
    totalCount += 1;
    completedCount += squareCredit(square, completedSquareIds, counts);
  }
  return { completedCount, totalCount };
}
