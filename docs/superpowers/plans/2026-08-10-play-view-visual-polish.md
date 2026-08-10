# Play View Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the per-card play view (`bingo-grid.tsx`) visual personality at every stage — cycling accent tints on untouched squares, a live progress bar, and satisfying hover/press/complete motion on CHECK and COUNTER controls — while leaving the existing celebration/blackout treatments untouched.

**Architecture:** A small color-blend utility (`mixColors`) backs an automated contrast regression test for the three new tint colors, following the existing `design-tokens.contrast.test.ts` pattern. The duplicated `isSquareDone` logic in `bingo-grid.tsx` moves to a new testable module (`src/lib/cards/client-progress.ts`) alongside a new `computeClientProgress` function that powers a progress bar rendered inside `BingoGrid`. Square tint cycling and interaction motion are Tailwind class changes plus one new CSS keyframe in `globals.css` for the completion bounce.

**Tech Stack:** Next.js 16 App Router, React, Tailwind CSS v4, Vitest (existing stack — no new dependencies).

**Reference:** `docs/superpowers/specs/2026-08-09-play-view-visual-polish-design.md`

---

### Task 1: `mixColors` helper + incomplete-square tint contrast regression test

**Files:**
- Modify: `src/lib/color-contrast.ts`
- Modify: `src/lib/color-contrast.test.ts`
- Modify: `src/app/design-tokens.contrast.test.ts`

This task adds the alpha-blend math needed to reason about Tailwind's `bg-primary/10`-style opacity utilities as concrete hex colors (they render as an alpha blend of the token color over whatever's beneath — here, `--background`, since the square `<div>` sets no opaque color first), then locks in that the three new incomplete-square tints stay readable, the same way every other token pairing in this file is already regression-tested.

- [ ] **Step 1: Write the failing test for `mixColors`**

Add to `src/lib/color-contrast.test.ts` (append to the existing file, new `describe` block):

```typescript
describe("mixColors", () => {
  it("returns the foreground color untouched at full alpha", () => {
    expect(mixColors("#ffffff", "#000000", 1)).toBe("#ffffff");
  });

  it("returns the background color untouched at zero alpha", () => {
    expect(mixColors("#ffffff", "#000000", 0)).toBe("#000000");
  });

  it("matches a hand-computed blend: primary at 10% over this app's light background", () => {
    // --primary (#e60053) at 10% alpha over --background (#fff9f0), light mode.
    expect(mixColors("#e60053", "#fff9f0", 0.1)).toBe("#fde0e0");
  });

  it("matches a hand-computed blend: primary at 10% over this app's dark background", () => {
    // --primary (#ff6aa2) at 10% alpha over --background (#171325), dark mode.
    expect(mixColors("#ff6aa2", "#171325", 0.1)).toBe("#2e1c32");
  });
});
```

Add the import at the top of the file:

```typescript
import { contrastRatio, mixColors } from "./color-contrast";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/color-contrast.test.ts`
Expected: FAIL — `mixColors` is not exported from `./color-contrast`.

- [ ] **Step 3: Implement `mixColors`**

Add to `src/lib/color-contrast.ts`, after the existing `hexToRgb` function (it's reused here):

```typescript
/**
 * Alpha-composites `foregroundHex` over `backgroundHex` at `alpha` (0–1) and
 * returns the resulting flat `#rrggbb` color — i.e. what a Tailwind
 * `bg-{color}/{opacity}` utility actually paints when nothing opaque sits
 * between the element and `backgroundHex`. Lets contrast tests reason about
 * semi-transparent utility classes as concrete colors.
 */
export function mixColors(foregroundHex: string, backgroundHex: string, alpha: number): string {
  const fg = hexToRgb(foregroundHex);
  const bg = hexToRgb(backgroundHex);
  const channel = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(channel(fg.r, bg.r))}${toHex(channel(fg.g, bg.g))}${toHex(channel(fg.b, bg.b))}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/color-contrast.test.ts`
Expected: PASS (existing `contrastRatio` tests + 4 new `mixColors` tests)

- [ ] **Step 5: Write the failing contrast regression test for the tint colors**

Add to `src/app/design-tokens.contrast.test.ts`, after the existing `import` lines:

```typescript
import { contrastRatio, mixColors } from "../lib/color-contrast";
```

(replace the existing `import { contrastRatio } from "../lib/color-contrast";` line with the one above)

Then append two new `describe` blocks at the end of the file:

```typescript
// The play view's incomplete-square tints (src/components/bingo-grid.tsx)
// render as bg-{color}/{opacity} directly on the square, with nothing
// opaque beneath but the page's --background — these tests blend the same
// way Tailwind does at paint time and check the result against the label
// text color, so a future token edit that breaks readability fails here
// instead of silently shipping.
describe("incomplete square tint contrast (light mode)", () => {
  it("primary/10 tint meets 4.5:1 for card-foreground text", () => {
    const blended = mixColors(LIGHT.primary, LIGHT.background, 0.1);
    expect(contrastRatio(blended, LIGHT["card-foreground"])).toBeGreaterThanOrEqual(4.5);
  });

  it("secondary/10 tint meets 4.5:1 for card-foreground text", () => {
    const blended = mixColors(LIGHT.secondary, LIGHT.background, 0.1);
    expect(contrastRatio(blended, LIGHT["card-foreground"])).toBeGreaterThanOrEqual(4.5);
  });

  it("accent/15 tint meets 4.5:1 for card-foreground text", () => {
    const blended = mixColors(LIGHT.accent, LIGHT.background, 0.15);
    expect(contrastRatio(blended, LIGHT["card-foreground"])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("incomplete square tint contrast (dark mode)", () => {
  it("primary/10 tint meets 4.5:1 for card-foreground text", () => {
    const blended = mixColors(DARK.primary, DARK.background, 0.1);
    expect(contrastRatio(blended, DARK["card-foreground"])).toBeGreaterThanOrEqual(4.5);
  });

  it("secondary/10 tint meets 4.5:1 for card-foreground text", () => {
    const blended = mixColors(DARK.secondary, DARK.background, 0.1);
    expect(contrastRatio(blended, DARK["card-foreground"])).toBeGreaterThanOrEqual(4.5);
  });

  it("accent/15 tint meets 4.5:1 for card-foreground text", () => {
    const blended = mixColors(DARK.accent, DARK.background, 0.15);
    expect(contrastRatio(blended, DARK["card-foreground"])).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 6: Run the test file**

Since `mixColors` was already implemented in Step 3, this is a regression guard rather than new failing behavior — it should pass on the first run.

Run: `npx vitest run src/app/design-tokens.contrast.test.ts`
Expected: PASS (all existing tests + 6 new tests). The blended values have been hand-verified ahead of time:
- Light: primary/10 → `#fde0e0` (contrast ~13.1:1), secondary/10 → `#f2e8f2` (~13.7:1), accent/15 → `#fff3d5` (~14.8:1)
- Dark: primary/10 → `#2e1c32` (~13.9:1), secondary/10 → `#241d3b` (~14.1:1), accent/15 → `#3a3130` (~11.1:1)

All comfortably clear 4.5:1. If any assertion fails, the tokens in `globals.css` have changed since this plan was written — treat that as a real regression to investigate, not a plan error.

- [ ] **Step 7: Commit**

```bash
git add src/lib/color-contrast.ts src/lib/color-contrast.test.ts src/app/design-tokens.contrast.test.ts
git commit -m "test: add mixColors helper and tint contrast regression tests

Assisted by Claude."
```

---

### Task 2: `computeClientProgress` helper + progress bar in `BingoGrid`

**Files:**
- Create: `src/lib/cards/client-progress.ts`
- Test: `src/lib/cards/client-progress.test.ts`
- Modify: `src/components/bingo-grid.tsx`

Moves the `isSquareDone` logic already living inline in `bingo-grid.tsx` (lines 37-52) into its own testable module, and adds a `computeClientProgress` function alongside it that the new progress bar uses.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/cards/client-progress.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { Square } from "@/lib/firestore/cards";
import { computeClientProgress, isSquareDone } from "./client-progress";

function square(overrides: Partial<Square> & { id: string; position: number }): Square {
  return {
    label: `Square ${overrides.id}`,
    kind: "CHECK",
    goal: 1,
    isFreeSpace: false,
    ...overrides,
  };
}

describe("isSquareDone", () => {
  it("is always done for a free space", () => {
    const sq = square({ id: "a", position: 0, isFreeSpace: true });
    expect(isSquareDone(sq, new Set(), {})).toBe(true);
  });

  it("is done for a CHECK square in the completed set", () => {
    const sq = square({ id: "a", position: 0, kind: "CHECK" });
    expect(isSquareDone(sq, new Set(["a"]), {})).toBe(true);
  });

  it("is not done for a CHECK square not in the completed set", () => {
    const sq = square({ id: "a", position: 0, kind: "CHECK" });
    expect(isSquareDone(sq, new Set(), {})).toBe(false);
  });

  it("is done for a COUNTER square whose count reached its goal", () => {
    const sq = square({ id: "a", position: 0, kind: "COUNTER", goal: 3 });
    expect(isSquareDone(sq, new Set(), { a: 3 })).toBe(true);
  });

  it("is not done for a COUNTER square below its goal", () => {
    const sq = square({ id: "a", position: 0, kind: "COUNTER", goal: 3 });
    expect(isSquareDone(sq, new Set(), { a: 2 })).toBe(false);
  });
});

describe("computeClientProgress", () => {
  it("returns zero counts for an empty square list", () => {
    expect(computeClientProgress([], new Set(), {})).toEqual({ completedCount: 0, totalCount: 0 });
  });

  it("excludes free space from both completed and total counts", () => {
    const squares = [
      square({ id: "free", position: 0, isFreeSpace: true }),
      square({ id: "a", position: 1, kind: "CHECK" }),
    ];
    expect(computeClientProgress(squares, new Set(), {})).toEqual({
      completedCount: 0,
      totalCount: 1,
    });
  });

  it("counts completed CHECK squares and in-progress COUNTER squares correctly", () => {
    const squares = [
      square({ id: "a", position: 0, kind: "CHECK" }),
      square({ id: "b", position: 1, kind: "CHECK" }),
      square({ id: "c", position: 2, kind: "COUNTER", goal: 5 }),
    ];
    const result = computeClientProgress(squares, new Set(["a"]), { c: 5 });
    expect(result).toEqual({ completedCount: 2, totalCount: 3 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/cards/client-progress.test.ts`
Expected: FAIL — `Cannot find module './client-progress'`

- [ ] **Step 3: Create the implementation**

Create `src/lib/cards/client-progress.ts`:

```typescript
import type { Square } from "@/lib/firestore/cards";

/**
 * A square is done when it's the free space, its counter reached goal, or (for CHECK
 * squares) it's in the completed set. This mirrors (but isn't the same as) the
 * `isSquareDone` in `src/lib/cards/progress.ts` — that version derives done-ness from
 * completion counts, while this one reads client-side `completedSquareIds`/`counts`
 * state directly, since CHECK-square toggles here don't update `counts`.
 */
export function isSquareDone(
  square: Square,
  completedSquareIds: Set<string>,
  counts: Record<string, number>,
): boolean {
  if (square.isFreeSpace) return true;
  if (square.kind === "COUNTER") return (counts[square.id] ?? 0) >= square.goal;
  return completedSquareIds.has(square.id);
}

export interface ClientProgress {
  completedCount: number;
  totalCount: number;
}

/**
 * Live completed/total counts for the play view's progress bar. Mirrors
 * `computeCardProgress` in `src/lib/cards/progress.ts` (free space excluded
 * from both counts) but reads client-side toggle state directly instead of
 * refetched completion docs, for the same reason `isSquareDone` above does.
 */
export function computeClientProgress(
  squares: Square[],
  completedSquareIds: Set<string>,
  counts: Record<string, number>,
): ClientProgress {
  let completedCount = 0;
  let totalCount = 0;
  for (const square of squares) {
    if (square.isFreeSpace) continue;
    totalCount += 1;
    if (isSquareDone(square, completedSquareIds, counts)) completedCount += 1;
  }
  return { completedCount, totalCount };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/cards/client-progress.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Wire the new module into `bingo-grid.tsx`, removing the duplicate**

In `src/components/bingo-grid.tsx`, remove the local `isSquareDone` function (lines 37-52) and its preceding blank line, then add the import alongside the existing imports (near the `getBingoLines` import):

```typescript
import { getBingoLines, type BingoLine } from "@/lib/cards/progress";
import { computeClientProgress, isSquareDone } from "@/lib/cards/client-progress";
```

- [ ] **Step 6: Add the progress computation inside `BingoGrid`**

Immediately after the existing `isBlackout` `useMemo` block (around line 98-101), add:

```typescript
  const { completedCount, totalCount } = useMemo(
    () => computeClientProgress(squares, completedSquareIds, counts),
    [squares, completedSquareIds, counts],
  );
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
```

- [ ] **Step 7: Render the progress bar as the first element in the returned JSX**

In the `return` statement of `BingoGrid` (starting around line 243), add the progress bar as the very first child, before the `celebrationTrigger` line:

```tsx
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completedCount} of ${totalCount} squares completed`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {celebrationTrigger > 0 && <BingoCelebration key={celebrationTrigger} lines={newLines} />}
```

(the rest of the existing `return` block is unchanged — only the new `role="progressbar"` block is inserted before the pre-existing `celebrationTrigger` line)

- [ ] **Step 8: Run the full test suite and typecheck**

Run: `npx vitest run`
Expected: PASS — all existing tests plus the new `client-progress.test.ts`.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Manually verify in the browser**

Start the dev server, open a card's play view. Confirm a colorful progress bar appears under the header, starting near-empty on a fresh card and filling in as squares are checked/counters reach goal, excluding the free space square from the count.

- [ ] **Step 10: Commit**

```bash
git add src/lib/cards/client-progress.ts src/lib/cards/client-progress.test.ts src/components/bingo-grid.tsx
git commit -m "feat: add live progress bar to the play view

Assisted by Claude."
```

---

### Task 3: Cycling accent tints for incomplete squares

**Files:**
- Modify: `src/components/bingo-grid.tsx`

Replaces the flat `border-control-border bg-card` incomplete-square treatment with a 3-way cycle keyed by `square.position`, using the tint colors already contrast-verified in Task 1.

- [ ] **Step 1: Add the tint class list**

In `src/components/bingo-grid.tsx`, add this constant above the `BingoSquareCell` function definition (near where `formatCompletionDate` or other module-level helpers live, or directly above `BingoSquareCell`):

```typescript
/**
 * Cycled by square position so incomplete squares read as a scattered
 * mosaic instead of a flat, uniform grid. Kept as tints (not solid fills)
 * so they stay visually distinct from the solid `bg-accent` free space and
 * solid `bg-success` completed/goal-reached squares. Contrast against
 * card-foreground label text for both light and dark mode is regression-
 * tested in `src/app/design-tokens.contrast.test.ts`.
 */
const INCOMPLETE_TINT_CLASSES = [
  "border-primary/40 bg-primary/10",
  "border-secondary/40 bg-secondary/10",
  "border-accent-on-surface/40 bg-accent/15",
] as const;
```

- [ ] **Step 2: Use the cycle in `sharedClassName`**

In `BingoSquareCell`, replace the `sharedClassName` definition (around line 398-407):

```typescript
  const sharedClassName = cn(
    "group relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border-2 p-1 text-center transition-colors duration-200 sm:gap-1 sm:p-2",
    isFreeSpace
      ? "border-accent bg-accent text-accent-foreground"
      : completed || goalReached
        ? "border-success bg-success text-success-foreground"
        : isPartial
          ? "border-success bg-success/20 text-card-foreground"
          : cn(
              INCOMPLETE_TINT_CLASSES[square.position % INCOMPLETE_TINT_CLASSES.length],
              "text-card-foreground",
            ),
  );
```

(the only changes are: `transition-colors duration-200` added to the base classes, and the final branch swapping the flat `border-control-border bg-card` for the cycled tint)

- [ ] **Step 3: Run typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manually verify in the browser**

Create (or open) a card with no free space and open its play view before checking anything, on both a mobile-width and desktop-width viewport. Confirm incomplete squares show three cycling colored tints instead of a flat white/neutral box, and that free space, completed, and partial-counter squares still look visually distinct from the new tints.

- [ ] **Step 5: Commit**

```bash
git add src/components/bingo-grid.tsx
git commit -m "feat: cycle accent tints on incomplete play-view squares

Assisted by Claude."
```

---

### Task 4: Hover/press interaction polish on CHECK and COUNTER controls

**Files:**
- Modify: `src/components/bingo-grid.tsx`

Adds a subtle lift on hover and a squish on press to the CHECK square's tappable button and the COUNTER +/− buttons.

- [ ] **Step 1: Add motion classes to the CHECK square button**

In `BingoSquareCell`, update the CHECK-interactive button's `className` (around line 501-503):

```tsx
      <button
        type="button"
        className="flex w-full flex-1 flex-col items-center justify-center gap-0.5 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:cursor-wait aria-disabled:opacity-70"
        aria-pressed={completed}
        aria-label={`Row ${row} of ${gridSize}, column ${col} of ${gridSize}: ${label} — ${completed ? "completed" : "not completed"}, tap to toggle`}
        aria-disabled={pending}
        onClick={() => onToggle(square)}
      >
```

- [ ] **Step 2: Add motion classes to the COUNTER +/− buttons**

Update both COUNTER buttons' `className` (around lines 456-465 and 469-478) — the decrement button:

```tsx
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
```

and the increment button:

```tsx
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
```

(only the `className` changed on both — added `transition-transform duration-150 hover:-translate-y-0.5 active:scale-95`)

- [ ] **Step 3: Run typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manually verify in the browser**

On desktop, hover over an unchecked CHECK square and the +/− buttons on a COUNTER square — confirm each lifts slightly. Click/press one — confirm it squishes down briefly. On mobile width, confirm tapping still works normally (no broken layout from the transform).

- [ ] **Step 5: Commit**

```bash
git add src/components/bingo-grid.tsx
git commit -m "feat: add hover/press motion to play-view square controls

Assisted by Claude."
```

---

### Task 5: Completion bounce animation

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/bingo-grid.tsx`

Adds a brief scale-up bounce on the square itself the moment a CHECK square is toggled done or a COUNTER square reaches its goal.

- [ ] **Step 1: Add the keyframe**

In `src/app/globals.css`, add this block after the existing `blackout-glow` keyframes (after line 159, before the `fade-in` keyframes — or if Task 2 of the prior `delightful-animations` plan already added `fade-in`/`fade-out`/etc. above `.font-display`, insert this new block immediately before `.font-display`):

```css
/* Brief scale-up "pop" played once on the square itself the instant a
   CHECK square is marked done or a COUNTER square reaches its goal. */
@keyframes square-complete-bounce {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}
```

- [ ] **Step 2: Track the done transition and apply the animation in `BingoSquareCell`**

All of `BingoSquareCell`'s hooks currently run before its early `if (!square) return ...` guard (around line 382) — the label-truncation `useState`/`useEffect` pair does this today by reading `square?.label` via optional chaining rather than waiting for the post-guard destructure. The new hooks must follow the same rule (hook call count/order can't change across renders of the same cell), so compute `isDone` the same optional-chaining way instead of relying on the post-guard `goalReached`.

In `src/components/bingo-grid.tsx`, add this immediately after the existing `const label = square?.label;` line (around line 355), before the `labelElement`/`isLabelTruncated` state declarations:

```typescript
  const isDone = completed || (square?.kind === "COUNTER" && count >= square.goal);
  const previousDoneRef = useRef(isDone);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (isDone && !previousDoneRef.current) {
      setJustCompleted(true);
    }
    previousDoneRef.current = isDone;
  }, [isDone]);
```

Add `useRef` to the existing `react` import at the top of the file:

```typescript
import { useEffect, useMemo, useRef, useState } from "react";
```

(`useEffect`, `useMemo`, and `useState` are already imported; only `useRef` is new to this import line — `useMemo` was already added by Task 2)

- [ ] **Step 3: Apply the animation class to the CHECK and COUNTER square divs**

In the COUNTER return block (around line 446-447), change:

```tsx
  if (isCounter) {
    return (
      <div
        className={cn(sharedClassName, justCompleted && "[animation:square-complete-bounce_300ms_ease-out]")}
        onAnimationEnd={() => setJustCompleted(false)}
      >
```

In the CHECK-interactive return block (around line 493-494), change:

```tsx
  return (
    <div
      className={cn(sharedClassName, justCompleted && "[animation:square-complete-bounce_300ms_ease-out]")}
      onAnimationEnd={() => setJustCompleted(false)}
    >
```

(both are the same pattern: the div's `className` becomes `cn(sharedClassName, justCompleted && "...")`, and it gains an `onAnimationEnd` handler that clears the one-shot flag once the bounce finishes)

- [ ] **Step 4: Run typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — this task doesn't change any tested pure logic, only `BingoSquareCell`'s render output, which has no dedicated component test today.

- [ ] **Step 6: Manually verify in the browser**

Tap a CHECK square — confirm it briefly pops/bounces as it turns to the success color. Increment a COUNTER square to its goal — confirm the same bounce plays on that square. Toggle a CHECK square off and back on — confirm the bounce replays each time it becomes done (not on the way to undone). Enable OS-level reduced motion and confirm the bounce is imperceptible (near-instant) rather than disabled outright, consistent with the rest of the app.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/components/bingo-grid.tsx
git commit -m "feat: bounce squares on completion in the play view

Assisted by Claude."
```

---

### Task 6: Final verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full pre-PR gate from AGENTS.md**

```bash
npm run lint
```
Expected: no errors.

```bash
npm run typecheck
```
Expected: no errors.

```bash
npm test
```
Expected: all tests pass, including the new `color-contrast.test.ts` additions, `design-tokens.contrast.test.ts` additions, and `client-progress.test.ts`.

```bash
npm run build
```
Expected: production build succeeds.

- [ ] **Step 2: Manually re-verify the full acceptance criteria from issue #53**

- Open a card with no free space, nothing checked, on mobile and desktop widths — confirm incomplete squares show cycling tints and the progress bar reads near-empty.
- Mark a CHECK square and a COUNTER square to goal — confirm hover/press feedback and the completion bounce play, and the existing checkmark/success styling is unchanged.
- Complete a full line and a full blackout — confirm the existing `BingoCelebration` badges/confetti/animations are unaffected.

- [ ] **Step 3: Report results**

Summarize pass/fail for each command and each manual check. If anything failed, fix it before considering this plan complete — do not skip ahead.
