# Bingo Line Celebration — Design

**Issue:** #14 — "Celebrate a new BINGO line — When a line completes, fire a celebration (confetti/animation). Foundation for the broader animation goal."

## Goal

When a player completes a new row, column, or diagonal on the play screen, show a lightweight, CSS-only celebration (confetti burst + "BINGO!" pop) — no new dependencies, matching existing design tokens.

## Trigger scope

Fires on **every newly completed line**, not just the first bingo. `BingoGrid` already recomputes `completedSquareIds` on toggle; it will additionally compute `getBingoLines(gridSize, doneByPosition)` (from `src/lib/cards/progress.ts`) after each toggle and diff against the previously-seen set of lines (tracked as `"type-index"` string keys in a `useRef<Set<string>>`). Any line present now but absent from the previous set is newly completed and triggers the celebration. Lines that later become "undone" (e.g. unchecking a square) are simply removed from the tracked set with no celebration.

## Components

- **`src/components/bingo-grid.tsx`** (existing, modified): after `handleProgressChange`/toggle updates state, compute lines, diff against the ref, and if there are new lines, bump a `celebrationTrigger` counter (number) in state.
- **`src/components/bingo-celebration.tsx`** (new, client component): accepts a `trigger: number` prop. Uses a `key={trigger}` remount trick so each new trigger value renders a fresh instance. Renders:
  - ~24 absolutely-positioned confetti pieces (small `<span>` squares) with randomized horizontal offset, rotation, and animation-delay, colored from the existing `--primary`/`--secondary`/`--accent`/`--success` tokens, falling/spinning via a new `@keyframes confetti-fall` in `globals.css`.
  - A "BINGO!" badge/toast that pops in using the existing (currently unused) `wobble` keyframe, then fades out.
  - Self-clears via `useEffect` + `setTimeout` (~1.5s) by rendering `null` after the animation window, so it doesn't block interaction or linger in the DOM.
- **`src/app/globals.css`** (modified): add `@keyframes confetti-fall` (translateY + rotate + fade) alongside the existing `wobble` keyframe.

## Data flow

```
toggle square → BingoGrid recomputes doneByPosition
             → getBingoLines(gridSize, doneByPosition)
             → diff vs ref of previously-seen line keys
             → new lines found? bump celebrationTrigger
             → <BingoCelebration trigger={celebrationTrigger} /> remounts and animates
```

Purely client-side visual feedback layered on top of existing toggle logic in the play page (`src/app/dashboard/cards/[id]/play/page.tsx` → `BingoGrid`). No server actions, no schema changes.

## Testing

- Existing `getBingoLines` unit tests already cover detection correctness — no new logic there.
- Manual verification in the browser: toggle squares to complete a row/column/diagonal and confirm the celebration fires once per new line, doesn't fire on already-seen lines, and clears itself.
- `npm run lint && npm run typecheck && npm run build` before considering the change done, per repo convention.

## Out of scope

- Sound effects.
- Persisting "which lines have already celebrated" across page reloads (resets each time the play page mounts — acceptable since the ref starts empty and immediately re-derives current lines as "already seen" on first render, so no celebration fires spuriously for lines that were already complete on load).
- Confetti library (canvas-confetti) — deferred; CSS-only for this pass per the "foundation for the broader animation goal" framing in the issue.
