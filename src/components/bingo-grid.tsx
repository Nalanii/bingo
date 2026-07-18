import { cn } from "@/lib/utils";
import type { Square } from "@/lib/firestore/cards";

interface BingoGridProps {
  gridSize: number;
  squares: Square[];
}

/**
 * Renders a bingo card's squares as a responsive, mobile-first CSS grid.
 * Pure presentation — no completion tracking or interactivity (see M2).
 */
export function BingoGrid({ gridSize, squares }: BingoGridProps) {
  const squaresByPosition = new Map(squares.map((square) => [square.position, square]));
  const slotCount = gridSize * gridSize;
  const slots = Array.from({ length: slotCount }, (_, position) => squaresByPosition.get(position));

  return (
    <div
      className="mx-auto grid w-full max-w-xl gap-1.5 sm:gap-2 md:gap-3"
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
    >
      {slots.map((square, position) => (
        <BingoSquareCell key={square?.id ?? position} square={square} />
      ))}
    </div>
  );
}

function BingoSquareCell({ square }: { square: Square | undefined }) {
  if (!square) {
    // Defensive: a slot without a matching square (shouldn't happen per the
    // data model, but a card must never crash rendering over it).
    return (
      <div className="border-border aspect-square rounded-[var(--radius-sm)] border-2 border-dashed" />
    );
  }

  const { isFreeSpace, kind, label, goal } = square;

  return (
    <div
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[var(--radius-sm)] border-2 p-1 text-center sm:gap-1 sm:p-2",
        isFreeSpace
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-card text-card-foreground",
      )}
    >
      {isFreeSpace ? (
        <>
          <span className="text-lg sm:text-xl" aria-hidden="true">
            ⭐
          </span>
          <span className="text-[0.6rem] font-bold tracking-wide uppercase sm:text-xs">Free</span>
        </>
      ) : (
        <>
          <span className="line-clamp-3 text-[0.65rem] leading-tight font-medium break-words sm:text-xs">
            {label}
          </span>
          {kind === "COUNTER" && (
            <span className="text-secondary text-[0.6rem] font-bold sm:text-xs">Goal: {goal}</span>
          )}
        </>
      )}
    </div>
  );
}
