/** The free space always sits in the center slot of an odd-sized grid. */
export function freeSpacePosition(gridSize: number): number {
  return Math.floor((gridSize * gridSize) / 2);
}
