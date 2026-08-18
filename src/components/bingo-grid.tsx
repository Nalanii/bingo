"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Square } from "@/lib/firestore/cards";
import { getBingoLines, type BingoLine } from "@/lib/cards/progress";
import { computeClientProgress, isSquareDone } from "@/lib/cards/client-progress";
import {
  decrementSquareProgress,
  getSquareCompletionHistory,
  incrementSquareProgress,
  toggleSquareCompletion,
} from "@/app/dashboard/cards/[id]/play/actions";
import { CompletionHistoryModal } from "@/components/completion-history-modal";
import { BingoCelebration } from "@/components/bingo-celebration";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";

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

  const [celebrationTrigger, setCelebrationTrigger] = useState(0);
  const [newLines, setNewLines] = useState<BingoLine[]>([]);
  const previousLineKeysRef = useRef<Set<string> | null>(null);
  const [blackoutTrigger, setBlackoutTrigger] = useState(0);
  const previousBlackoutRef = useRef<boolean | null>(null);

  // Lifted to render time (not just inside the effect below) so the persistent
  // "BINGO!" indicator can reflect current state, not just newly-completed lines.
  const currentLines = useMemo(() => {
    const doneByPosition = new Map<number, boolean>();
    for (const square of squares) {
      doneByPosition.set(square.position, isSquareDone(square, completedSquareIds, counts));
    }
    return getBingoLines(gridSize, doneByPosition);
  }, [squares, completedSquareIds, counts, gridSize]);
  const hasBingo = currentLines.length > 0;

  // Lifted to render time (like currentLines above) so the persistent blackout
  // badge can reflect current state, not just newly-completed blackouts.
  const isBlackout = useMemo(
    () => squares.length > 0 && squares.every((square) => isSquareDone(square, completedSquareIds, counts)),
    [squares, completedSquareIds, counts],
  );

  const { completedCount, totalCount } = useMemo(
    () => computeClientProgress(squares, completedSquareIds, counts),
    [squares, completedSquareIds, counts],
  );
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  useEffect(() => {
    const currentLineKeys = new Set(currentLines.map((line) => `${line.type}-${line.index}`));
    const previousLineKeys = previousLineKeysRef.current;
    previousLineKeysRef.current = currentLineKeys;

    const previousBlackout = previousBlackoutRef.current;
    previousBlackoutRef.current = isBlackout;

    // Seed on mount without celebrating lines/blackout that were already complete on load.
    if (previousLineKeys === null) return;

    const isNewBlackout = previousBlackout !== null && !previousBlackout && isBlackout;
    if (isNewBlackout) {
      setBlackoutTrigger((prev) => prev + 1);
      return;
    }

    const linesJustCompleted = currentLines.filter(
      (line) => !previousLineKeys.has(`${line.type}-${line.index}`),
    );
    if (linesJustCompleted.length > 0) {
      setNewLines(linesJustCompleted);
      setCelebrationTrigger((prev) => prev + 1);
    }
  }, [currentLines, isBlackout]);

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
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${progressPercent}% complete`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {celebrationTrigger > 0 && <BingoCelebration key={celebrationTrigger} lines={newLines} />}
      {blackoutTrigger > 0 && (
        <BingoCelebration key={`blackout-${blackoutTrigger}`} variant="blackout" />
      )}
      {(hasBingo || isBlackout) && (
        <div className="mx-auto flex items-center gap-1.5">
          {hasBingo && (
            <span
              role="status"
              className="rounded-full bg-accent px-3 py-1 text-xs font-bold tracking-wide text-accent-foreground uppercase shadow-sm"
            >
              Bingo!
            </span>
          )}
          {isBlackout && (
            <span
              role="status"
              className="rounded-full border-2 border-primary bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%] px-3 py-1 text-xs font-bold tracking-wide text-primary-foreground uppercase shadow-sm"
              style={{ animation: "blackout-glow 2s ease-in-out infinite" }}
            >
              Blackout!
            </span>
          )}
        </div>
      )}
      <div
        // overflow-x-clip (not hidden): a square's hover tooltip
        // (`Tooltip` in ui/tooltip.tsx) is `w-max` up to 16rem, wider than
        // any square, so on an edge column it geometrically extends past
        // this grid's own box even though it's invisible until hover. Left
        // unclipped, that box still counts toward the document's
        // scrollable overflow, widening the page and forcing real
        // horizontal scroll on mobile (worse on iOS Safari, which doesn't
        // reliably honor `overflow-x: hidden` on body alone — see the
        // matching `html` rule in globals.css). Clipping only the x-axis
        // here (not overflow-hidden, which would also clip the y-axis)
        // keeps a tooltip popping up above row 1 fully visible.
        className="mx-auto grid w-full max-w-xl items-start gap-1.5 overflow-x-clip sm:gap-2 md:gap-3"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {slots.map((square, position) => (
          <BingoSquareCell
            key={square?.id ?? position}
            square={square}
            gridSize={gridSize}
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
        <ConfirmDialog
          ariaLabel={`Undo completion of ${squareToUncheck.label}?`}
          message={
            <>
              Undo completion of <span className="font-bold">{squareToUncheck.label}</span>? This
              permanently deletes its completion history.
            </>
          }
          confirmLabel="Undo"
          onCancel={() => setSquareToUncheck(null)}
          onConfirm={() => {
            const square = squareToUncheck;
            setSquareToUncheck(null);
            performToggle(square);
          }}
        />
      )}
    </div>
  );
}

/**
 * One consistent pink tint for every incomplete square — a per-square color
 * cycle was tried first but read as confusing rather than lively, so all
 * incomplete squares share this tint instead. Kept as a tint (not a solid
 * fill) so it stays visually distinct from the solid `bg-accent` free space
 * and solid `bg-success` completed/goal-reached squares. Contrast against
 * card-foreground label text for both light and dark mode is regression-
 * tested in `src/app/design-tokens.contrast.test.ts`.
 */
const INCOMPLETE_TINT_CLASS = "border-primary/40 bg-primary/10";

function BingoSquareCell({
  square,
  gridSize,
  completed,
  count,
  latestCompletionDate,
  pending,
  onToggle,
  onProgressChange,
  onViewHistory,
}: {
  square: Square | undefined;
  gridSize: number;
  completed: boolean;
  count: number;
  latestCompletionDate: string | undefined;
  pending: boolean;
  onToggle: (square: Square) => void;
  onProgressChange: (square: Square, direction: "increment" | "decrement") => void;
  onViewHistory: (square: Square) => void;
}) {
  const label = square?.label;
  const isDone = completed || (square?.kind === "COUNTER" && count >= square.goal);
  const previousDoneRef = useRef(isDone);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (isDone && !previousDoneRef.current) {
      setJustCompleted(true);
    }
    previousDoneRef.current = isDone;
  }, [isDone]);

  // A state setter (not a plain useRef) doubling as the ref callback: the
  // shared Tooltip renders its wrapped children directly (no DOM node) when
  // `isLabelTruncated` is false and wraps them in a real `<span>` once it's
  // true, which changes this element's type across that render and forces
  // React to unmount/remount it. A useRef+useEffect(deps: [label]) pair
  // wouldn't reattach the ResizeObserver to that new node since `label`
  // itself didn't change; tracking the node in state re-runs the effect below
  // whenever it does.
  const [labelElement, setLabelElement] = useState<HTMLSpanElement | null>(null);
  const [isLabelTruncated, setIsLabelTruncated] = useState(false);

  useEffect(() => {
    if (!labelElement) return;

    function checkTruncation() {
      if (!labelElement) return;
      setIsLabelTruncated(labelElement.scrollHeight > labelElement.clientHeight + 1);
    }

    checkTruncation();

    const observer = new ResizeObserver(checkTruncation);
    observer.observe(labelElement);
    return () => observer.disconnect();
  }, [labelElement, label]);

  if (!square) {
    // Defensive: a slot without a matching square (shouldn't happen per the
    // data model, but a card must never crash rendering over it).
    return (
      <div className="border-border aspect-square rounded-[var(--radius-sm)] border-2 border-dashed" />
    );
  }

  const { isFreeSpace, kind, goal } = square;
  const row = Math.floor(square.position / gridSize) + 1;
  const col = (square.position % gridSize) + 1;
  const isCheckInteractive = kind === "CHECK" && !isFreeSpace;
  const isCounter = kind === "COUNTER" && !isFreeSpace;
  const goalReached = isCounter && count >= goal;
  const isPartial = isCounter && count > 0 && !goalReached;

  const sharedClassName = cn(
    "group relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border-2 p-1 text-center transition-colors duration-200 sm:gap-1 sm:p-2",
    isFreeSpace
      ? "border-accent bg-accent text-accent-foreground"
      : completed || goalReached
        ? "border-success bg-success text-success-foreground"
        : isPartial
          ? "border-success bg-success/20 text-card-foreground"
          : cn(INCOMPLETE_TINT_CLASS, "text-card-foreground"),
  );

  if (isFreeSpace) {
    return (
      <div className={sharedClassName}>
        <span className="text-lg sm:text-xl" aria-hidden="true">
          ⭐
        </span>
        <span className="text-[0.6rem] font-bold tracking-wide uppercase sm:text-xs">Free space</span>
      </div>
    );
  }

  const renderLabel = (clampClass: string, textSizeClass: string) => (
    <Tooltip label={isLabelTruncated ? label : undefined} className="block w-full">
      <span
        ref={setLabelElement}
        className={cn(clampClass, textSizeClass, "leading-tight font-medium break-words")}
      >
        {label}
      </span>
    </Tooltip>
  );

  const historyDateButton = (label: string, date: string) => (
    <button
      type="button"
      className="flex items-center gap-1 text-[0.55rem] leading-tight italic hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-col sm:items-start sm:text-[0.6rem]"
      aria-label={`${label} ${date}`}
      onClick={(event) => {
        event.stopPropagation();
        onViewHistory(square);
      }}
    >
      {/* Below sm, the label+date pair takes more height than a mobile
          square can stay a true square and fit — swap to a compact icon
          that keeps the tap target and history-viewing affordance without
          the text's height cost. Full text returns at sm+, where squares
          have room. */}
      <History aria-hidden="true" className="h-3 w-3 shrink-0 sm:hidden" />
      <span className="hidden sm:inline">{label}</span>
      <span className="hidden sm:inline">{date}</span>
    </button>
  );

  if (isCounter) {
    return (
      <div
        className={cn(sharedClassName, justCompleted && "[animation:square-complete-bounce_300ms_ease-out]")}
        onAnimationEnd={() => setJustCompleted(false)}
      >
        {goalReached && (
          <Check
            aria-hidden="true"
            // hidden below sm: reserving this badge's own space at the top
            // of an already-tight mobile square (on top of the label, +/-
            // row, and history icon) pushed the square's own min-content
            // height past its width, stretching it into a rectangle again.
            // The background already switches to the success color when
            // the goal is reached, so completion still reads clearly on
            // mobile without the corner badge; the badge returns at sm+
            // where there's room for it without a fight over space.
            className="text-success-foreground pointer-events-none absolute top-1 right-1 hidden h-4 w-4 sm:block"
          />
        )}
        {/* 2 lines (not 3) below sm: a COUNTER square already spends height
            on the +/- row and, once it has history, the icon-only history
            button, so a 3-line label pushes the whole cell past a true
            square at mobile widths. The full label is still reachable via
            the truncation tooltip. */}
        {renderLabel("line-clamp-2 sm:line-clamp-3", "text-[0.6rem] sm:text-xs")}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="text-sm leading-none transition-transform duration-150 hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:cursor-wait aria-disabled:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
            aria-label={`Row ${row} of ${gridSize}, column ${col} of ${gridSize}: Decrease progress on ${label}`}
            aria-disabled={pending}
            disabled={count <= 0}
            onClick={() => onProgressChange(square, "decrement")}
          >
            −
          </button>
          <span aria-live="polite" className="text-[0.6rem] font-bold sm:text-xs">
            {count}/{goal}
          </span>
          <button
            type="button"
            className="text-sm leading-none transition-transform duration-150 hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:cursor-wait aria-disabled:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
            aria-label={`Row ${row} of ${gridSize}, column ${col} of ${gridSize}: Increase progress on ${label}`}
            aria-disabled={pending}
            disabled={count >= goal}
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

  // 3 lines (not 4) below sm: a completed CHECK square's checkmark badge
  // sits absolutely in the top-right corner, and a fully-4-line label
  // centered in a mobile-width square reaches close enough to that corner
  // to visually collide with it. Capping to 3 lines leaves headroom above
  // the text either way; the full label is still reachable via the
  // truncation tooltip. The same crowding also pushes the square's own
  // content taller than its width, breaking the square aspect ratio (see
  // the matching COUNTER comment below).
  const content = renderLabel("line-clamp-3 sm:line-clamp-4", "text-[0.65rem] sm:text-xs");

  if (!isCheckInteractive) {
    return <div className={sharedClassName}>{content}</div>;
  }

  return (
    <div
      className={cn(sharedClassName, justCompleted && "[animation:square-complete-bounce_300ms_ease-out]")}
      onAnimationEnd={() => setJustCompleted(false)}
    >
      {completed && (
        <Check
          aria-hidden="true"
          // hidden below sm: same tradeoff as the COUNTER goalReached badge
          // above — reserving this badge's own space at the top of an
          // already-tight mobile square (on top of a multi-line label and
          // the history icon) pushed the square's own min-content height
          // past its width, stretching it into a rectangle again. The
          // background already switches to the success color when
          // completed, so completion still reads clearly on mobile without
          // the corner badge; it returns at sm+ where there's room.
          className="text-success-foreground pointer-events-none absolute top-1 right-1 hidden h-4 w-4 sm:block"
        />
      )}
      <button
        type="button"
        className="flex w-full flex-1 flex-col items-center justify-center gap-0.5 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:cursor-wait aria-disabled:opacity-70"
        aria-pressed={completed}
        aria-label={`Row ${row} of ${gridSize}, column ${col} of ${gridSize}: ${label} — ${completed ? "completed" : "not completed"}, tap to toggle`}
        aria-disabled={pending}
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
