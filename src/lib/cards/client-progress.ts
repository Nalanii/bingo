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
  completedCount: number;
  totalCount: number;
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
    if (isSquareDone(square, completedSquareIds, counts)) completedCount += 1;
  }
  return { completedCount, totalCount };
}
