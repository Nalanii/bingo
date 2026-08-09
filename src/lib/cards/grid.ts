/** The two grid sizes a card can be built with. */
export const CARD_GRID_SIZES = [3, 5] as const;

export type CardGridSize = (typeof CARD_GRID_SIZES)[number];

/** Checks whether a value is one of the supported grid sizes. */
export function isValidGridSize(value: number): value is CardGridSize {
  return CARD_GRID_SIZES.includes(value as CardGridSize);
}

/** The free space always sits in the center slot of an odd-sized grid. */
export function freeSpacePosition(gridSize: number): number {
  return Math.floor((gridSize * gridSize) / 2);
}

/** Total squares on a grid, minus the free space slot if the card has one. */
export function squareCount(gridSize: number, hasFreeSpace: boolean): number {
  return gridSize * gridSize - (hasFreeSpace ? 1 : 0);
}
