"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Square } from "@/lib/firestore/cards";
import {
  decrementSquareProgress,
  getSquareCompletionHistory,
  incrementSquareProgress,
  toggleSquareCompletion,
} from "@/app/dashboard/cards/[id]/play/actions";
import { CompletionHistoryModal } from "@/components/completion-history-modal";

interface BingoGridProps {
  cardId: string;
  gridSize: number;
  squares: Square[];
  initialCompletedSquareIds: string[];
  initialCounts: Record<string, number>;
  initialLatestCompletionDates: Record<string, string>;
}

/** Formats an ISO 8601 timestamp as a local date with a full month name, e.g. "January 1, 2026". */
function formatCompletionDate(completedAt: string): string {
  return new Date(completedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
  initialLatestCompletionDates,
}: BingoGridProps) {
  const [completedSquareIds, setCompletedSquareIds] = useState(
    () => new Set(initialCompletedSquareIds),
  );
  const [counts, setCounts] = useState<Record<string, number>>(() => ({ ...initialCounts }));
  const [latestCompletionDates, setLatestCompletionDates] = useState<Record<string, string>>(
    () => ({ ...initialLatestCompletionDates }),
  );
  const [pendingSquareIds, setPendingSquareIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [historySquare, setHistorySquare] = useState<Square | null>(null);
  const [squareToUncheck, setSquareToUncheck] = useState<Square | null>(null);

  /** Refetches a square's completion history and updates its displayed latest date. */
  async function refreshLatestCompletionDate(squareId: string) {
    const result = await getSquareCompletionHistory(cardId, squareId);
    if (!result.ok) return;

    setLatestCompletionDates((prev) => {
      const next = { ...prev };
      if (result.entries.length > 0) {
        next[squareId] = result.entries[0].completedAt;
      } else {
        delete next[squareId];
      }
      return next;
    });
  }

  const squaresByPosition = new Map(squares.map((square) => [square.position, square]));
  const slotCount = gridSize * gridSize;
  const slots = Array.from({ length: slotCount }, (_, position) => squaresByPosition.get(position));

  function handleToggle(square: Square) {
    if (pendingSquareIds.has(square.id)) return;

    // Un-checking deletes the square's only completion doc, permanently
    // losing its completed date — confirm before doing that.
    if (completedSquareIds.has(square.id)) {
      setSquareToUncheck(square);
      return;
    }

    performToggle(square);
  }

  async function performToggle(square: Square) {
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
        await refreshLatestCompletionDate(square.id);
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
        await refreshLatestCompletionDate(square.id);
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
            latestCompletionDate={square ? latestCompletionDates[square.id] : undefined}
            pending={square ? pendingSquareIds.has(square.id) : false}
            onToggle={handleToggle}
            onProgressChange={handleProgressChange}
            onViewHistory={setHistorySquare}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-center text-sm">
          {error}
        </p>
      )}
      {historySquare && (
        <CompletionHistoryModal
          cardId={cardId}
          square={historySquare}
          onClose={() => setHistorySquare(null)}
          onEntriesChange={(entries) => {
            setLatestCompletionDates((prev) => {
              const next = { ...prev };
              if (entries.length > 0) {
                next[historySquare.id] = entries[0].completedAt;
              } else {
                delete next[historySquare.id];
              }
              return next;
            });
          }}
        />
      )}
      {squareToUncheck && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSquareToUncheck(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={`Undo ${squareToUncheck.label}?`}
            className="border-border bg-card text-card-foreground mx-4 flex w-full max-w-sm flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm">
              Undo <span className="font-bold">{squareToUncheck.label}</span>? This permanently
              deletes its completion history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="border-border bg-card text-card-foreground rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium"
                onClick={() => setSquareToUncheck(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="border-destructive bg-destructive text-destructive-foreground rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium"
                onClick={() => {
                  const square = squareToUncheck;
                  setSquareToUncheck(null);
                  performToggle(square);
                }}
              >
                Undo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BingoSquareCell({
  square,
  completed,
  count,
  latestCompletionDate,
  pending,
  onToggle,
  onProgressChange,
  onViewHistory,
}: {
  square: Square | undefined;
  completed: boolean;
  count: number;
  latestCompletionDate: string | undefined;
  pending: boolean;
  onToggle: (square: Square) => void;
  onProgressChange: (square: Square, direction: "increment" | "decrement") => void;
  onViewHistory: (square: Square) => void;
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
    "group relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border-2 p-1 text-center sm:gap-1 sm:p-2",
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

  const renderLabel = (clampClass: string, textSizeClass: string) => (
    <div className="relative w-full">
      <span
        className={cn(clampClass, textSizeClass, "leading-tight font-medium break-words")}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className="border-border bg-card text-card-foreground pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max max-w-[9rem] -translate-x-1/2 scale-95 rounded-[var(--radius-sm)] border px-2 py-1 text-center text-[0.65rem] leading-snug font-medium opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 sm:text-xs"
      >
        {label}
      </span>
    </div>
  );

  const historyDateButton = (label: string, date: string) => (
    <button
      type="button"
      className="flex flex-col text-[0.55rem] leading-tight italic opacity-80 hover:underline sm:text-[0.6rem]"
      onClick={(event) => {
        event.stopPropagation();
        onViewHistory(square);
      }}
    >
      <span>{label}</span>
      <span>{date}</span>
    </button>
  );

  if (isCounter) {
    return (
      <div className={sharedClassName}>
        {renderLabel("line-clamp-3", "text-[0.6rem] sm:text-xs")}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="text-card-foreground text-sm leading-none disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
            aria-label={`Decrease progress on ${label}`}
            disabled={pending || count <= 0}
            onClick={() => onProgressChange(square, "decrement")}
          >
            −
          </button>
          <span aria-live="polite" className="text-[0.6rem] font-bold sm:text-xs">
            {count}/{goal}
          </span>
          <button
            type="button"
            className="text-card-foreground text-sm leading-none disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
            aria-label={`Increase progress on ${label}`}
            disabled={pending || count >= goal}
            onClick={() => onProgressChange(square, "increment")}
          >
            +
          </button>
        </div>
        {count > 0 &&
          latestCompletionDate &&
          historyDateButton("Last completed:", formatCompletionDate(latestCompletionDate))}
      </div>
    );
  }

  const content = renderLabel("line-clamp-4", "text-[0.65rem] sm:text-xs");

  if (!isCheckInteractive) {
    return <div className={sharedClassName}>{content}</div>;
  }

  return (
    <div className={sharedClassName}>
      <button
        type="button"
        className="flex w-full flex-1 flex-col items-center justify-center gap-0.5 disabled:cursor-wait disabled:opacity-70"
        aria-pressed={completed}
        aria-label={`${label} — ${completed ? "completed" : "not completed"}, tap to toggle`}
        disabled={pending}
        onClick={() => onToggle(square)}
      >
        {content}
      </button>
      {completed &&
        latestCompletionDate &&
        historyDateButton("Completed:", formatCompletionDate(latestCompletionDate))}
    </div>
  );
}
