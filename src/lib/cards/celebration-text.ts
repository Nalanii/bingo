import type { BingoLine } from "./progress";

/** Human-readable description of a single completed bingo line. */
export function describeLine(line: BingoLine): string {
  if (line.type === "diagonal") {
    return line.index === 0
      ? "the top-left to bottom-right diagonal"
      : "the top-right to bottom-left diagonal";
  }
  return `${line.type} ${line.index + 1}`;
}

/**
 * Screen-reader announcement text for the set of lines that just completed.
 * `fallback` is used verbatim when `lines` is empty (e.g. a caller that
 * hasn't wired up line-tracking yet, or an unexpected empty-array case).
 */
export function buildLineSrText(lines: BingoLine[], fallback: string): string {
  if (lines.length === 0) return fallback;
  if (lines.length === 1) return `Bingo! You completed ${describeLine(lines[0])}.`;
  return `Bingo! You completed ${lines.length} lines: ${lines.map(describeLine).join(", ")}.`;
}
