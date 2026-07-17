import type { CardSettings, SquareDraft } from "./types";

export type PositionedSquareDraft = SquareDraft & { position: number };

/** The free space always sits in the center slot of an odd-sized grid. */
function freeSpacePosition(gridSize: number): number {
  return Math.floor((gridSize * gridSize) / 2);
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Assigns each square a grid position, once. RANDOM cards get a shuffled
 * order; SET cards keep entry order. The result should be persisted as-is so
 * the card's layout stays stable on every future visit.
 */
export function assignPositions(
  squares: SquareDraft[],
  settings: CardSettings,
): PositionedSquareDraft[] {
  const total = settings.gridSize * settings.gridSize;
  const reservedPosition = settings.hasFreeSpace
    ? freeSpacePosition(settings.gridSize)
    : -1;

  const availablePositions = Array.from({ length: total }, (_, i) => i).filter(
    (position) => position !== reservedPosition,
  );

  const orderedPositions =
    settings.layout === "RANDOM"
      ? shuffled(availablePositions)
      : availablePositions;

  return squares.map((square, index) => ({
    ...square,
    position: orderedPositions[index],
  }));
}
