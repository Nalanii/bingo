# Full-Card Blackout Celebration — Design

**Issue:** #15 — "Celebrate a full-card blackout — Special celebration when every square is complete."

## Goal

When a player completes the last remaining square on the play screen, show a bigger, distinct celebration than the existing per-line one (see [`docs/superpowers/specs/2026-07-18-bingo-celebration-design.md`](./2026-07-18-bingo-celebration-design.md)) — more confetti, a "Blackout!" badge, longer on screen. Still CSS-only, no new dependencies.

## Trigger scope

Fires once per **transition into a fully-complete grid** — every square done (free space, CHECK completed, or COUNTER at goal). `BingoGrid` already derives `doneByPosition`/per-square done-ness each render for line detection; it will additionally compute `isBlackout = squares.every(...)` and diff against a `useRef<boolean>` (seeded on mount, same "don't celebrate what was already true on load" rule as line detection).

Completing the last square of a grid necessarily completes every row, column, and (if square) both diagonals simultaneously, so the existing line-celebration effect would also fire on that same toggle. To avoid stacking two celebrations on top of each other, when a blackout is newly achieved the effect skips bumping the line-celebration trigger for that render and only bumps the blackout trigger. Line celebrations still fire normally for every other new line completed before the grid is full.

## Components

- **`src/components/bingo-celebration.tsx`** (modified): add an optional `variant?: "line" | "blackout"` prop (default `"line"`). Blackout variant uses more confetti pieces, a longer visible duration, and a "Blackout!" badge instead of "Bingo!". Same confetti-fall/wobble keyframes — no new CSS.
- **`src/components/bingo-grid.tsx`** (modified): add a `blackoutTrigger` counter and a `previousBlackoutRef`, computed alongside the existing line-detection effect. Renders `<BingoCelebration key={...} variant="blackout" />` when a new blackout fires (in addition to, and independent from, the existing line celebration element).

## Data flow

```
toggle/progress change → BingoGrid recomputes doneByPosition (existing)
                       → isBlackout = every square done
                       → diff vs previousBlackoutRef
                       → newly true? bump blackoutTrigger, skip line trigger this run
                       → otherwise: existing line-diff logic runs as today
```

## Testing

- Manual verification in the browser: complete every square on a small (3x3) test card and confirm the blackout celebration fires once, instead of the regular line celebration firing on that same final toggle.
- Verify unchecking a square after a blackout and re-completing it fires the blackout celebration again (mirrors the existing line re-fire behavior — intentional, not a bug).
- Verify no celebration fires on page load for a card that's already fully complete.
- `npm run lint && npm run typecheck && npm run build` before considering the change done, per repo convention.

## Out of scope

- Sound effects.
- Persisting celebration state across reloads (same as line celebration).
- A confetti library — still CSS-only.
