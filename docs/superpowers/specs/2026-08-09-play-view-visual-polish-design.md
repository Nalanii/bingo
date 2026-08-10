# Play view visual polish — design

Issue: [#53](https://github.com/nalanii/bingo/issues/53)

## Problem

The per-card play view ([src/app/dashboard/cards/[id]/play/page.tsx](../../../src/app/dashboard/cards/%5Bid%5D/play/page.tsx) + [src/components/bingo-grid.tsx](../../../src/components/bingo-grid.tsx)) is visually flat, especially at the start of a card (no free space, nothing checked). Every incomplete square renders as the same plain `bg-card` box with a thin border. The dashboard card list ([#28](https://github.com/nalanii/bingo/issues/28)) already got a "fun/funky" pass; this page still reads as an inert form rather than something fun to play.

## Goals

- Give incomplete squares visual personality, using existing design tokens (no new colors).
- Make the board read as lively at zero progress, not just once squares are completed.
- Add satisfying hover/press/complete feedback to CHECK and COUNTER interactions.
- Preserve the existing Bingo/Blackout badges and `BingoCelebration` treatments unchanged — they stay the high point.
- Mobile and desktop both work.

## Non-goals

- No changes to `bingo-celebration.tsx` or the existing line/blackout celebration animations.
- No changes to the header's structural elements (back arrow, title, edit pencil) — no icon-button hover redesign beyond what already exists.
- No dedicated empty-state element (prompt text, illustration). The tint cycle + progress bar are judged sufficient signal that the board is interactive at zero progress.

## Design

### 1. Incomplete square styling — cycling accent tints

Currently (`sharedClassName` in `BingoSquareCell`, [bingo-grid.tsx:398-407](../../../src/components/bingo-grid.tsx#L398-L407)):

```
isFreeSpace
  ? "border-accent bg-accent text-accent-foreground"
  : completed || goalReached
    ? "border-success bg-success text-success-foreground"
    : isPartial
      ? "border-success bg-success/20 text-card-foreground"
      : "border-control-border bg-card text-card-foreground"  // ← flat, target of this change
```

Replace the final (incomplete, non-partial) branch with a 3-way cycle keyed by `square.position` (not row/col), so the pattern reads as a scattered mosaic rather than banded rows:

```ts
const INCOMPLETE_ACCENT_CLASSES = [
  "border-primary/40 bg-primary/10",
  "border-secondary/40 bg-secondary/10",
  "border-accent-on-surface/40 bg-accent/15",
] as const;
```

Selected via `INCOMPLETE_ACCENT_CLASSES[square.position % INCOMPLETE_ACCENT_CLASSES.length]`, combined with `text-card-foreground` for label contrast (all three tints are light enough in both light/dark mode — verify against `--color-card-foreground` contrast during implementation; fall back to a slightly stronger tint opacity if a combination fails 4.5:1 for the label text in dark mode).

These tints stay clearly distinguishable from the solid `bg-accent` free space and solid `bg-success` done/goal-reached squares, and from the existing `bg-success/20` partial-counter treatment (different hue family), so state readability (todo vs. in-progress vs. done vs. free space) is preserved.

### 2. Header — progress bar under the title

A slim rounded bar showing `completedCount / totalCount` (free space excluded from both, matching `computeCardProgress` in [src/lib/cards/progress.ts:61](../../../src/lib/cards/progress.ts#L61)):

- Track: `bg-muted`, full width, ~6px tall, rounded.
- Fill: gradient `from-primary to-accent` (or solid `bg-primary` if the gradient reads muddy against tints — decide during implementation by eyeballing both), width set via inline `style={{ width: `${percent}%` }}`, `transition-[width]` for smooth movement as squares are marked.

Progress state (`completedSquareIds`, `counts`) lives in the client `BingoGrid`, not the server-rendered header in `page.tsx`. Rather than lifting state up or converting the header to a client component, the progress bar renders as the **first element inside `BingoGrid`'s returned JSX**, above the existing Bingo!/Blackout! badge row. Because `page.tsx` renders `<BingoGrid>` immediately after the header `<div>`, this sits visually right under the `<h1>` with no header changes needed.

Compute `completedCount`/`totalCount` alongside the existing `currentLines`/`isBlackout` `useMemo`s in `BingoGrid`, reusing the local `isSquareDone` helper — same free-space-excluded logic as `computeCardProgress`, kept as a separate client-side computation (like `isSquareDone` already is) since it reads live toggle state rather than re-fetching.

At zero progress this renders as a bar at 0% on a colored track — one visible cue (along with the square tints) that this is a live board, satisfying goal #2 without a dedicated empty-state element.

### 3. Interaction polish — scale + color transition

Applies to: the CHECK square's tappable `<button>` ([bingo-grid.tsx:501](../../../src/components/bingo-grid.tsx#L501)) and the COUNTER +/− `<button>`s ([bingo-grid.tsx:456,469](../../../src/components/bingo-grid.tsx#L456)).

- **Hover** (non-touch, via `hover:` which no-ops on touch): subtle lift (`hover:-translate-y-0.5`) plus the existing color/border already transitions via `transition-colors` — extend to `transition` (or explicit `transition-[transform,background-color,border-color]`) so both animate together.
- **Press**: `active:scale-95` for a quick squish, matching the tactile feel elsewhere in the app.
- **On completion** (CHECK toggled to done, or COUNTER reaching goal): a brief scale-up bounce. Reuse the existing `pop-in` keyframe (`scale(0.92)` → `scale(1)` with fade) already defined in `globals.css` if it reads well at square scale; if it feels too subtle/fade-heavy for a square that's already visible (not entering/exiting), define a small dedicated `square-complete-bounce` keyframe (e.g. `scale(1) → scale(1.08) → scale(1)`, no opacity change) triggered via a one-shot class applied on the render where `completed`/`goalReached` just became true (mirroring how `BingoCelebration` remounts via a `key` bump — here, likely a `useEffect` comparing previous vs. current done-ness per square, or a CSS animation keyed off a `data-` attribute that changes value).
- Respects the app-wide `prefers-reduced-motion` collapse already in `globals.css` (all animation/transition durations zero out) — no additional opt-out logic needed.

### Files touched

- [src/components/bingo-grid.tsx](../../../src/components/bingo-grid.tsx) — tint cycling, progress bar, hover/press/complete transitions
- [src/app/globals.css](../../../src/app/globals.css) — possibly one new keyframe for the completion bounce, if `pop-in` doesn't fit
- No changes to `page.tsx` header markup or `bingo-celebration.tsx`

## Testing

- Create a card with no free space; open play view on mobile and desktop widths — confirm square tints and 0% progress bar are visible before anything is marked.
- Mark a CHECK square and a COUNTER square to goal — confirm hover/press feedback, completion bounce, and existing checkmark/success styling all work.
- Complete a full line and a full blackout — confirm existing `BingoCelebration` badges/confetti/animations are unaffected.
- Verify contrast of label text against each of the three tint classes in light and dark mode.
- Verify `prefers-reduced-motion: reduce` collapses the new transitions/animations like existing ones.
