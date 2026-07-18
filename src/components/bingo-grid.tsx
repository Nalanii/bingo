"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Square } from "@/lib/firestore/cards";
import {
  decrementSquareProgress,
  incrementSquareProgress,
  toggleSquareCompletion,
} from "@/app/dashboard/cards/[id]/play/actions";

interface BingoGridProps {
  cardId: string;
  gridSize: number;
  squares: Square[];
  initialCompletedSquareIds: string[];
  initialCounts: Record<string, number>;
}

/**
 * Renders a bingo card's squares as a responsive, mobile-first CSS grid.
 * CHECK squares are tappable to toggle completion; COUNTER squares expose
 * increment/decrement controls that track progress toward their goal.
 */
export function BingoGrid({
  cardId,
  gridSize,
  squares,
  initialCompletedSquareIds,
  initialCounts,
}: BingoGridProps) {
  const [completedSquareIds, setCompletedSquareIds] = useState(
    () => new Set(initialCompletedSquareIds),
  );
  const [counts, setCounts] = useState<Record<string, number>>(() => ({ ...initialCounts }));
  const [pendingSquareIds, setPendingSquareIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const squaresByPosition = new Map(squares.map((square) => [square.position, square]));
  const slotCount = gridSize * gridSize;
  const slots = Array.from({ length: slotCount }, (_, position) => squaresByPosition.get(position));

  async function handleToggle(square: Square) {
    if (pendingSquareIds.has(square.id)) return;

    const wasCompleted = completedSquareIds.has(square.id);
    setError(null);
    setPendingSquareIds((prev) => new Set(prev).add(square.id));
    setCompletedSquareIds((prev) => {
      const next = new Set(prev);
      if (wasCompleted) {
        next.delete(square.id);
      } else {
        next.add(square.id);
      }
      return next;
    });

    try {
      const result = await toggleSquareCompletion(cardId, square.id);
      if (!result.ok) {
        setCompletedSquareIds((prev) => {
          const next = new Set(prev);
          if (wasCompleted) {
            next.add(square.id);
          } else {
            next.delete(square.id);
          }
          return next;
        });
        setError(result.error);
      } else {
        setCompletedSquareIds((prev) => {
          const next = new Set(prev);
          if (result.completed) {
            next.add(square.id);
          } else {
            next.delete(square.id);
          }
          return next;
        });
      }
    } finally {
      setPendingSquareIds((prev) => {
        const next = new Set(prev);
        next.delete(square.id);
        return next;
      });
    }
  }

  async function handleProgressChange(square: Square, direction: "increment" | "decrement") {
    if (pendingSquareIds.has(square.id)) return;

    const previousCount = counts[square.id] ?? 0;
    setError(null);
    setPendingSquareIds((prev) => new Set(prev).add(square.id));
    setCounts((prev) => ({
      ...prev,
      [square.id]: direction === "increment" ? previousCount + 1 : Math.max(previousCount - 1, 0),
    }));

    try {
      const result =
        direction === "increment"
          ? await incrementSquareProgress(cardId, square.id)
          : await decrementSquareProgress(cardId, square.id);

      if (!result.ok) {
        setCounts((prev) => ({ ...prev, [square.id]: previousCount }));
        setError(result.error);
      } else {
        setCounts((prev) => ({ ...prev, [square.id]: result.count }));
      }
    } finally {
      setPendingSquareIds((prev) => {
        const next = new Set(prev);
        next.delete(square.id);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="mx-auto grid w-full max-w-xl gap-1.5 sm:gap-2 md:gap-3"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {slots.map((square, position) => (
          <BingoSquareCell
            key={square?.id ?? position}
            square={square}
            completed={square ? completedSquareIds.has(square.id) : false}
            count={square ? (counts[square.id] ?? 0) : 0}
            pending={square ? pendingSquareIds.has(square.id) : false}
            onToggle={handleToggle}
            onProgressChange={handleProgressChange}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-center text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function BingoSquareCell({
  square,
  completed,
  count,
  pending,
  onToggle,
  onProgressChange,
}: {
  square: Square | undefined;
  completed: boolean;
  count: number;
  pending: boolean;
  onToggle: (square: Square) => void;
  onProgressChange: (square: Square, direction: "increment" | "decrement") => void;
}) {
  if (!square) {
    // Defensive: a slot without a matching square (shouldn't happen per the
    // data model, but a card must never crash rendering over it).
    return (
      <div className="border-border aspect-square rounded-[var(--radius-sm)] border-2 border-dashed" />
    );
  }

  const { isFreeSpace, kind, label, goal } = square;
  const isCheckInteractive = kind === "CHECK" && !isFreeSpace;
  const isCounter = kind === "COUNTER" && !isFreeSpace;
  const goalReached = isCounter && count >= goal;
  const isPartial = isCounter && count > 0 && !goalReached;

  const sharedClassName = cn(
    "flex aspect-square flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[var(--radius-sm)] border-2 p-1 text-center sm:gap-1 sm:p-2",
    isFreeSpace
      ? "border-accent bg-accent text-accent-foreground"
      : completed || goalReached
        ? "border-success bg-success text-success-foreground"
        : isPartial
          ? "border-success/50 bg-success/50 text-card-foreground"
          : "border-border bg-card text-card-foreground",
  );

  if (isFreeSpace) {
    return (
      <div className={sharedClassName}>
        <span className="text-lg sm:text-xl" aria-hidden="true">
          ⭐
        </span>
        <span className="text-[0.6rem] font-bold tracking-wide uppercase sm:text-xs">Free</span>
      </div>
    );
  }

  if (isCounter) {
    return (
      <div className={sharedClassName}>
        <span className="line-clamp-2 text-[0.6rem] leading-tight font-medium break-words sm:text-xs">
          {label}
        </span>
        <span aria-live="polite" className="text-[0.6rem] font-bold sm:text-xs">
          {count}/{goal}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="border-border bg-card text-card-foreground flex h-5 w-5 items-center justify-center rounded-full border text-xs leading-none disabled:cursor-not-allowed disabled:opacity-40 sm:h-6 sm:w-6"
            aria-label={`Decrease progress on ${label}`}
            disabled={pending || count <= 0}
            onClick={() => onProgressChange(square, "decrement")}
          >
            −
          </button>
          <button
            type="button"
            className="border-border bg-card text-card-foreground flex h-5 w-5 items-center justify-center rounded-full border text-xs leading-none disabled:cursor-not-allowed disabled:opacity-40 sm:h-6 sm:w-6"
            aria-label={`Increase progress on ${label}`}
            disabled={pending || count >= goal}
            onClick={() => onProgressChange(square, "increment")}
          >
            +
          </button>
        </div>
      </div>
    );
  }

  const content = (
    <span className="line-clamp-3 text-[0.65rem] leading-tight font-medium break-words sm:text-xs">
      {label}
    </span>
  );

  if (!isCheckInteractive) {
    return <div className={sharedClassName}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={cn(sharedClassName, "disabled:cursor-wait disabled:opacity-70")}
      aria-pressed={completed}
      aria-label={`${label} — ${completed ? "completed" : "not completed"}, tap to toggle`}
      disabled={pending}
      onClick={() => onToggle(square)}
    >
      {content}
    </button>
  );
}
