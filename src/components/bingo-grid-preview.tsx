import { cn } from "@/lib/utils";

export type PreviewSquare =
  | { position: number; label: string; isFreeSpace: true }
  | {
      position: number;
      label: string;
      isFreeSpace?: false;
      kind: "CHECK" | "COUNTER";
      goal: number;
    };

/**
 * Read-only mini bingo grid, used to preview a card's layout before it's
 * saved (e.g. the builder's review step). Squares are still drafts with no
 * Firestore ids at this point, so — unlike `BingoGrid` — this component has
 * no click handlers, progress controls, or completion state.
 */
export function BingoGridPreview({
  gridSize,
  squares,
}: {
  gridSize: number;
  squares: PreviewSquare[];
}) {
  const squaresByPosition = new Map(squares.map((square) => [square.position, square]));
  const slotCount = gridSize * gridSize;
  const slots = Array.from({ length: slotCount }, (_, position) => squaresByPosition.get(position));

  return (
    <div
      className="mx-auto grid w-full max-w-xl gap-1.5 sm:gap-2 md:gap-3"
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
    >
      {slots.map((square, position) => (
        <BingoPreviewCell key={square?.label ?? position} square={square} />
      ))}
    </div>
  );
}

function BingoPreviewCell({ square }: { square: PreviewSquare | undefined }) {
  if (!square) {
    // Defensive: a slot without a matching square (shouldn't happen per the
    // data model, but the preview must never crash rendering over it).
    return (
      <div className="border-border aspect-square rounded-[var(--radius-sm)] border-2 border-dashed" />
    );
  }

  const sharedClassName = cn(
    "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border-2 p-1 text-center sm:gap-1 sm:p-2",
    square.isFreeSpace
      ? "border-accent bg-accent text-accent-foreground"
      : "border-control-border bg-card text-card-foreground",
  );

  if (square.isFreeSpace) {
    return (
      <div className={sharedClassName}>
        <span className="text-lg sm:text-xl" aria-hidden="true">
          ⭐
        </span>
        <span className="text-[0.6rem] font-bold tracking-wide uppercase sm:text-xs">Free space</span>
      </div>
    );
  }

  return (
    <div className={sharedClassName}>
      <span className="line-clamp-4 text-[0.65rem] leading-tight font-medium break-words sm:text-xs">
        {square.label}
      </span>
      {square.kind === "COUNTER" && (
        <span className="text-[0.6rem] font-bold sm:text-xs">to {square.goal}</span>
      )}
    </div>
  );
}
