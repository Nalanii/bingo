# Bingo Line Celebration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a player completes a new row, column, or diagonal on the play screen, fire a lightweight CSS-only confetti burst + "BINGO!" badge — no new dependencies.

**Architecture:** `BingoGrid` (`src/components/bingo-grid.tsx`) already tracks `completedSquareIds` and `counts` in state. After each render where those change, an effect derives a `doneByPosition` map and calls the existing `getBingoLines(gridSize, doneByPosition)` helper (`src/lib/cards/progress.ts`), diffing the result against a `useRef`-held set of previously-seen line keys. Any line present now but not previously seen bumps a `celebrationTrigger` counter, which mounts a fresh `<BingoCelebration key={celebrationTrigger} />` — a new client component that renders ~24 CSS-animated confetti pieces plus a wobbling "BINGO!" badge, then self-clears after ~1.5s.

**Tech Stack:** TypeScript, React (client component), Tailwind CSS v4 (`@theme inline` tokens in `src/app/globals.css`). No new npm dependencies.

Design doc: `docs/superpowers/specs/2026-07-18-bingo-celebration-design.md`.

---

### Task 1: Add the confetti-fall keyframe to globals.css

**Files:**
- Modify: `src/app/globals.css:88-97`

- [ ] **Step 1: Add `@keyframes confetti-fall` next to the existing `wobble` keyframe**

In `src/app/globals.css`, immediately after the closing `}` of the existing `@keyframes wobble` block (currently ending at line 97, right before `.font-display`), insert:

```css

/* Confetti pieces fall, spin, and fade out — used by BingoCelebration. */
@keyframes confetti-fall {
  0% {
    transform: translateY(-10%) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(320%) rotate(540deg);
    opacity: 0;
  }
}
```

- [ ] **Step 2: Verify the file still parses correctly**

Run: `npm run lint`
Expected: no errors (CSS isn't linted by ESLint, but this confirms the repo's lint step still runs cleanly before further changes).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add confetti-fall keyframe for bingo celebrations"
```

---

### Task 2: Create the BingoCelebration component

**Files:**
- Create: `src/components/bingo-celebration.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/bingo-celebration.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

const CONFETTI_COLORS = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-accent)",
  "var(--color-success)",
];
const CONFETTI_COUNT = 24;
const VISIBLE_DURATION_MS = 1500;

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  rotation: number;
  color: string;
}

function createConfettiPieces(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, id) => ({
    id,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 1 + Math.random() * 0.6,
    rotation: Math.random() * 360,
    color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
  }));
}

/**
 * One-shot confetti burst + "BINGO!" badge. Mount with a fresh `key` (e.g.
 * an incrementing trigger counter) each time a new line completes so this
 * remounts and re-animates instead of reusing a cleared-out instance.
 */
export function BingoCelebration() {
  const [pieces] = useState(createConfettiPieces);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), VISIBLE_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 h-2.5 w-2.5 rounded-sm"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotation}deg)`,
            animation: `confetti-fall ${piece.duration}s ease-in ${piece.delay}s forwards`,
          }}
        />
      ))}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2">
        <span
          className="font-display border-accent bg-accent text-accent-foreground inline-block rounded-[var(--radius-sm)] border-2 px-4 py-2 text-lg font-bold tracking-wide uppercase shadow-lg"
          style={{ animation: "wobble 0.4s ease-in-out 2" }}
        >
          Bingo!
        </span>
      </div>
      <p role="status" className="sr-only">
        Bingo! You completed a line.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/bingo-celebration.tsx
git commit -m "feat: add BingoCelebration confetti component"
```

---

### Task 3: Wire line detection into BingoGrid

**Files:**
- Modify: `src/components/bingo-grid.tsx`

- [ ] **Step 1: Add imports**

In `src/components/bingo-grid.tsx`, change the top imports (currently lines 1-12) to add `useEffect` and `useRef` to the React import, and import `getBingoLines` and `BingoCelebration`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Square } from "@/lib/firestore/cards";
import { getBingoLines } from "@/lib/cards/progress";
import {
  decrementSquareProgress,
  getSquareCompletionHistory,
  incrementSquareProgress,
  toggleSquareCompletion,
} from "@/app/dashboard/cards/[id]/play/actions";
import { CompletionHistoryModal } from "@/components/completion-history-modal";
import { BingoCelebration } from "@/components/bingo-celebration";
```

- [ ] **Step 2: Add an `isSquareDone` helper above the `BingoGrid` component**

Insert this after `formatCompletionDate` (currently ending at line 30) and before the `BingoGrid` export (currently line 37):

```tsx
/** A square is done when it's the free space, its counter reached goal, or (for CHECK squares) it's in the completed set. */
function isSquareDone(
  square: Square,
  completedSquareIds: Set<string>,
  counts: Record<string, number>,
): boolean {
  if (square.isFreeSpace) return true;
  if (square.kind === "COUNTER") return (counts[square.id] ?? 0) >= square.goal;
  return completedSquareIds.has(square.id);
}
```

- [ ] **Step 3: Add celebration state and detection effect inside `BingoGrid`**

Inside the `BingoGrid` function body, after the existing `useState` declarations (after `squareToUncheck` state, currently line 55) and before `refreshLatestCompletionDate` (currently line 58), add:

```tsx
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);
  const previousLineKeysRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const doneByPosition = new Map<number, boolean>();
    for (const square of squares) {
      doneByPosition.set(square.position, isSquareDone(square, completedSquareIds, counts));
    }

    const currentLineKeys = new Set(
      getBingoLines(gridSize, doneByPosition).map((line) => `${line.type}-${line.index}`),
    );
    const previousLineKeys = previousLineKeysRef.current;
    previousLineKeysRef.current = currentLineKeys;

    // Seed on mount without celebrating lines that were already complete on load.
    if (previousLineKeys === null) return;

    const hasNewLine = Array.from(currentLineKeys).some((key) => !previousLineKeys.has(key));
    if (hasNewLine) {
      setCelebrationTrigger((prev) => prev + 1);
    }
  }, [completedSquareIds, counts, squares, gridSize]);
```

- [ ] **Step 4: Render the celebration**

In the returned JSX, add the celebration as the first child of the outer `<div className="flex flex-col gap-2">` (currently line 172), right before the grid `<div>`:

```tsx
      {celebrationTrigger > 0 && <BingoCelebration key={celebrationTrigger} />}
```

So the top of the return block reads:

```tsx
  return (
    <div className="flex flex-col gap-2">
      {celebrationTrigger > 0 && <BingoCelebration key={celebrationTrigger} />}
      <div
        className="mx-auto grid w-full max-w-xl gap-1.5 sm:gap-2 md:gap-3"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/bingo-grid.tsx
git commit -m "feat: celebrate newly completed bingo lines"
```

---

### Task 4: Manual verification and build

**Files:** none (verification only)

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

- [ ] **Step 2: Open a card's play page in a browser and complete a line**

Navigate to `/dashboard/cards/[id]/play` for a card with an incomplete row. Tap squares to complete an entire row, column, or diagonal.

Expected: confetti pieces fall from the top of the screen and a "BINGO!" badge pops in and wobbles, then everything clears after ~1.5s.

- [ ] **Step 3: Verify it doesn't re-fire for an already-completed line**

Toggle a square that's part of an already-completed line off and back on (without completing any new line).

Expected: no celebration fires, since that line's key was already in the previously-seen set before and after (once re-completed).

- [ ] **Step 4: Verify a second, different line triggers a second celebration**

Complete a different row/column/diagonal.

Expected: the celebration fires again for the new line.

- [ ] **Step 5: Verify no celebration fires on page load for a card that already has a bingo**

Open the play page for a card that already has a completed line from a previous session.

Expected: no celebration fires on initial render (only on new completions after mount).

- [ ] **Step 6: Full verification suite**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all three pass with no errors.
