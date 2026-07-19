# Full-Card Blackout Celebration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on worktrees:** this repo's convention (per user instruction) is to commit straight to `main` in the main working directory — do NOT create a git worktree or feature branch for this work, even though subagent-driven-development normally recommends one.

**Goal:** When a player completes the last remaining square on the play screen (full-card blackout), fire a bigger, distinct celebration — more confetti + a "Blackout!" badge, on screen longer than the regular per-line celebration.

**Architecture:** `BingoGrid` (`src/components/bingo-grid.tsx`) already derives per-square done-ness and diffs newly-completed bingo lines each render (see `docs/superpowers/plans/2026-07-18-bingo-celebration.md`). This plan adds a parallel blackout check: `isBlackout = squares.every(square => isSquareDone(...))`, diffed against a `useRef<boolean>` seeded on mount. A newly-true blackout bumps a `blackoutTrigger` counter and skips the line-celebration bump for that same render (since completing the last square always completes every line too, and we don't want both celebrations firing on the same toggle). `BingoCelebration` (`src/components/bingo-celebration.tsx`) gains a `variant?: "line" | "blackout"` prop controlling confetti count, duration, and badge text.

Design doc: `docs/superpowers/specs/2026-07-18-bingo-blackout-celebration-design.md`.

---

### Task 1: Add a `variant` prop to `BingoCelebration`

**Files:**
- Modify: `src/components/bingo-celebration.tsx`

**Context:** The component currently hardcodes 24 confetti pieces, a 1500ms visible duration, and a "Bingo!" badge. It's rendered as `<BingoCelebration key={celebrationTrigger} />` from `src/components/bingo-grid.tsx:216`.

- [ ] **Step 1: Add the `variant` prop and per-variant config**

Add a `BingoCelebrationVariant = "line" | "blackout"` type and a `BingoCelebrationProps { variant?: BingoCelebrationVariant }` interface (default `"line"`). Introduce a small config keyed by variant with:
  - `confettiCount`: 24 for `"line"`, 48 for `"blackout"`
  - `visibleDurationMs`: 1500 for `"line"`, 2500 for `"blackout"`
  - `badgeText`: `"Bingo!"` for `"line"`, `"Blackout!"` for `"blackout"`
  - `srText`: `"Bingo! You completed a line."` for `"line"`, `"Blackout! You completed the whole card."` for `"blackout"`

Use the resolved config's `confettiCount` when calling `createConfettiPieces`, its `visibleDurationMs` in the `setTimeout`, and its `badgeText`/`srText` in the JSX in place of the current hardcoded `"Bingo!"` / `"Bingo! You completed a line."` strings. Keep everything else (colors, animation names, layout, self-clearing behavior) unchanged.

Update the component's doc comment to mention the new prop.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/bingo-celebration.tsx
git commit -m "feat: add blackout variant to BingoCelebration"
```

---

### Task 2: Detect full-card blackout and fire the blackout celebration in `BingoGrid`

**Files:**
- Modify: `src/components/bingo-grid.tsx`

**Context:** `BingoGrid` already has an effect (currently `src/components/bingo-grid.tsx:79-98`) that computes `doneByPosition` from `squares`/`completedSquareIds`/`counts`, diffs `getBingoLines(...)` results against `previousLineKeysRef`, and bumps `celebrationTrigger` on new lines. This task adds a sibling blackout check inside that same effect (single source of truth for done-ness, computed once per run) and a second trigger/component for the blackout celebration.

- [ ] **Step 1: Add blackout state**

Alongside the existing `celebrationTrigger`/`previousLineKeysRef` declarations (`src/components/bingo-grid.tsx:76-77`), add:

```tsx
const [blackoutTrigger, setBlackoutTrigger] = useState(0);
const previousBlackoutRef = useRef<boolean | null>(null);
```

- [ ] **Step 2: Compute blackout inside the existing detection effect**

Inside the effect body (`src/components/bingo-grid.tsx:79-98`), after building `doneByPosition` (which already has one entry per square) and before returning early on `previousLineKeys === null`, add:

```tsx
const isBlackout = squares.length > 0 && squares.every((square) =>
  isSquareDone(square, completedSquareIds, counts),
);
const previousBlackout = previousBlackoutRef.current;
previousBlackoutRef.current = isBlackout;
const isNewBlackout = previousBlackout !== null && !previousBlackout && isBlackout;

if (isNewBlackout) {
  setBlackoutTrigger((prev) => prev + 1);
}
```

Then change the existing line-celebration bump so it's skipped when a blackout just fired (completing the last square always completes every line too, and both celebrations firing at once would look broken):

```tsx
const hasNewLine = Array.from(currentLineKeys).some((key) => !previousLineKeys.has(key));
if (hasNewLine && !isNewBlackout) {
  setCelebrationTrigger((prev) => prev + 1);
}
```

Keep the existing `if (previousLineKeys === null) return;` early-return for line detection where it is — it should run *after* the blackout computation above so blackout state is still seeded correctly on the mounting render (mirroring how line keys are seeded), but before the `hasNewLine` check. Reorder so both refs (`previousLineKeysRef`, `previousBlackoutRef`) get seeded before either early-returns, then bail out of the rest of the new-completion logic on the seeding render.

- [ ] **Step 3: Render the blackout celebration**

In the returned JSX (`src/components/bingo-grid.tsx:215-216`), alongside the existing line celebration render, add:

```tsx
{blackoutTrigger > 0 && <BingoCelebration key={`blackout-${blackoutTrigger}`} variant="blackout" />}
```

Placed right after the existing `{celebrationTrigger > 0 && <BingoCelebration key={celebrationTrigger} />}` line. Use distinct `key` namespaces (`blackout-${n}` vs. the existing plain `n`) since they're now two sibling elements that must remount independently.

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/bingo-grid.tsx
git commit -m "feat: celebrate full-card blackout"
```

---

### Task 3: Manual verification and build

**Files:** none (verification only)

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

- [ ] **Step 2: Complete every square on a card and confirm the blackout celebration fires**

Navigate to `/dashboard/cards/[id]/play` for a small card (ideally 3x3) with several squares still incomplete. Complete all but one square, then complete the last one.

Expected: the blackout celebration fires (more confetti, "Blackout!" badge, ~2.5s on screen) — and the regular line celebration does NOT also fire on that same final toggle, even though completing the last square completes multiple lines at once.

- [ ] **Step 3: Confirm regular line celebrations still fire before the card is full**

Before reaching full completion, complete an individual row/column/diagonal that doesn't finish the whole card.

Expected: the normal "Bingo!" line celebration fires as before (unaffected by this change).

- [ ] **Step 4: Confirm re-triggering after undo**

After a blackout, uncheck one square (breaking the blackout), then re-complete it.

Expected: the blackout celebration fires again on re-completion (same intentional re-fire behavior as line celebrations).

- [ ] **Step 5: Confirm no celebration fires on page load for an already-complete card**

Open the play page for a card that was already fully complete from a previous session.

Expected: no celebration (blackout or line) fires on initial render.

- [ ] **Step 6: Full verification suite**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all three pass with no errors.
