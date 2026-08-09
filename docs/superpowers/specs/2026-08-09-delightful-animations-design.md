# Delightful animations everywhere — design

GitHub issue: [#27](https://github.com/Nalanii/bingo/issues/27) — "Micro-interactions and
transitions throughout the app."

## Problem

Animation today is inconsistent: `Button` has hover/active micro-interactions
(`hover:-translate-y-0.5 active:scale-95`), and `bingo-celebration.tsx` has a rich
one-shot confetti/wobble sequence — but most of the app (route changes, dashboard card
list, form controls, dialogs, skeleton loaders, the card builder wizard) is instant with
no transition at all. The issue asks for a pass of tasteful, consistent micro-interactions
across the app.

## Approach

Pure CSS: Tailwind transition utilities plus a small set of shared `@keyframes` added to
`src/app/globals.css`, following the existing pattern (`wobble`, `confetti-fall`,
`blackout-flash`, `blackout-shimmer`, `blackout-glow`). No new dependency (no Framer
Motion), no new required `"use client"` boundaries except where a component needs
mount-triggered animation state.

Style: **subtle & snappy** — 150–250ms transitions, no bounce/spring easing. Consistent
with `Button`'s existing timing (`duration-150`).

Accessibility: every new animation is gated by `@media (prefers-reduced-motion: reduce)`
in `globals.css`, which collapses durations to near-zero — consistent with how the rest
of the app already treats accessibility as a first-class concern (sr-only status text in
`bingo-celebration.tsx`, `completion-history-modal.tsx`).

## Shared primitives (`globals.css`)

New keyframes/utility classes alongside the existing celebration ones:

- `fade-in` — opacity 0 → 1.
- `slide-up-fade` — translateY(8px) + opacity 0 → translateY(0) + opacity 1. Used for
  route content and builder steps.
- `pop` — scale(0.92) → scale(1) with opacity, for confirmation moments (square saved).
- `shimmer` — background-position sweep, for skeleton loading blocks (replacing plain
  `animate-pulse` where a shimmer reads better).

A `prefers-reduced-motion: reduce` block sets `animation-duration: 0.01ms !important` and
`transition-duration: 0.01ms !important` globally, matching the standard pattern for this
media query.

## Areas

### 1. Page/route transitions

A small client component, `src/components/page-transition.tsx`, wraps route content and
applies `slide-up-fade` on mount, re-keyed by `usePathname()` so it re-triggers on
navigation. Applied in:

- `src/app/dashboard/layout.tsx` — wraps `{children}`.
- `src/app/layout.tsx` — wraps `{children}` for the signed-out landing page.

This is the only area that needs a new `"use client"` boundary; everything else layers
CSS onto existing markup/components without changing their server/client nature.

### 2. Interactive elements

Extend the hover/active treatment already established by `Button`:

- **Dashboard card list items** (`src/app/dashboard/page.tsx`) — hover lift + shadow
  transition, consistent with `Button`'s `hover:-translate-y-0.5`.
- **Form inputs** (`Input`, `SegmentedControl`, `Switch` in `src/components/ui/`) — focus
  ring transition instead of instant snap; `Switch` thumb slide gets an explicit
  `transition-transform`.
- **`ConfirmDialog` / `CompletionHistoryModal`** — fade+scale in on open, fade out on
  close, instead of the current instant show/hide. Modal open/close is currently driven
  by conditional rendering, so this needs a brief exit-animation delay (matching pattern:
  keep rendering for the transition's duration before unmounting).
- **`Tooltip`** — fade+slight-scale on show, replacing the instant appearance.

### 3. Loading & empty states

- Skeleton components (`builder-skeleton.tsx`, `dashboard/loading.tsx`,
  `cards/new/loading.tsx`, `cards/[id]/edit/loading.tsx`, `cards/[id]/play/loading.tsx`)
  swap `animate-pulse` for the new `shimmer` keyframe, which reads more polished at the
  same performance cost.
- Empty states (dashboard's "No cards yet", completion history's "No completions yet")
  get a `fade-in` on mount.

### 4. Card builder flow

- `card-builder.tsx` — wraps the active step in `slide-up-fade`, re-keyed by step index,
  so moving forward/back between `card-settings-step`, `square-entry-step`, and
  `review-step` transitions instead of snapping.
- `square-entry-step.tsx` — the square list item gets a `pop` animation when a new square
  is added/saved, giving positive confirmation feedback.

## Testing

Animations are CSS-driven with no branching logic to unit test, matching the precedent
set by `loading.tsx` files (`2026-08-04-loading-empty-error-states-design.md`: "static
markup — no conditional logic, so no test value"). Exceptions:

- `page-transition.tsx` re-keys on `usePathname()` — gets a component test verifying it
  re-renders (remounts) its children when the pathname changes.
- Modal open/close exit-animation timing (`ConfirmDialog`, `CompletionHistoryModal`) gets
  a test verifying the dialog is still in the DOM immediately after `onClose` fires and is
  removed after the transition duration elapses (using fake timers).

Everything else is verified manually in the browser per area, plus the standard
pre-PR gate: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`.

## Out of scope

- `bingo-grid.tsx` square-check animations and `bingo-celebration.tsx` itself — already
  well-animated, not part of this pass.
- Page-transition direction awareness (e.g. slide left vs. right based on navigation
  depth) — a single fade+slide-up treats all route changes the same, which is enough for
  this pass.
- Any new dependency (Framer Motion, native View Transitions API) — deferred until a
  concrete need outgrows pure CSS.
