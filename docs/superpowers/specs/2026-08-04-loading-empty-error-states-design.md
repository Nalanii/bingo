# Loading, empty, and error states — design

GitHub issue: [#18](https://github.com/Nalanii/bingo/issues/18) — "Cover async views with
proper loading, empty, and error UI."

## Problem

Four route segments under `/dashboard` do async Firestore reads (via `getUser()`,
`listCardsByOwner()`, `getCard()`, `getCompletions()`) with:

- **No loading UI.** Without a `loading.tsx`, Next.js shows a blank/frozen screen while
  the page awaits data.
- **No error boundary.** An unhandled Firestore error (missing composite index,
  transient outage, misconfigured Admin SDK) falls through to Next's generic, off-brand
  error page.

The affected routes:

- `/dashboard` — card list (`src/app/dashboard/page.tsx`)
- `/dashboard/cards/new` — builder, create mode (`src/app/dashboard/cards/new/page.tsx`)
- `/dashboard/cards/[id]/edit` — builder, edit mode
  (`src/app/dashboard/cards/[id]/edit/page.tsx`)
- `/dashboard/cards/[id]/play` — bingo grid (`src/app/dashboard/cards/[id]/play/page.tsx`)

**Empty states are already solid** and out of scope here: the dashboard has a "No cards
yet" empty state (`src/app/dashboard/page.tsx`), and the completion-history modal has
"No completions yet" (`src/components/completion-history-modal.tsx`). The builder always
has at least one square by validation, so there's no empty-state gap there. This design
covers loading + error only, and treats empty-state coverage as already done.

## Loading states — shape-matched skeletons

One `loading.tsx` per route (Next.js's built-in convention: wraps the segment's
`page.tsx` in a Suspense boundary automatically). Each uses Tailwind's `animate-pulse`
on blocks shaped like the real content, rather than a generic spinner:

- **`src/app/dashboard/loading.tsx`** — skeleton title/button bar + a grid of
  card-shaped blocks, mirroring the `sm:grid-cols-2 lg:grid-cols-3` layout in
  `dashboard/page.tsx`.
- **Builder skeleton** — a shared component
  (`src/app/dashboard/cards/_builder/builder-skeleton.tsx`) rendering a back-link block,
  title block, a handful of input-row blocks, and a button-row block, matching the first
  step of `CardBuilder`. Used by both:
  - `src/app/dashboard/cards/new/loading.tsx`
  - `src/app/dashboard/cards/[id]/edit/loading.tsx`
- **`src/app/dashboard/cards/[id]/play/loading.tsx`** — back-link/title blocks plus a
  5×5 grid of square blocks. The real grid size (3 or 5) isn't known until the fetch
  resolves, so 5×5 is used as a reasonable default shape.

Each skeleton container uses `role="status"` with an sr-only loading label (e.g.
"Loading your cards…"), and the pulsing blocks themselves get `aria-hidden="true"` —
consistent with the sr-only status pattern already used in
`completion-history-modal.tsx` and `bingo-celebration.tsx`.

## Error state — one shared dashboard `error.tsx`

A single `src/app/dashboard/error.tsx` covers all four routes. Next.js error boundaries
nest by segment, so one `error.tsx` at the `dashboard` segment catches errors thrown by
`dashboard/page.tsx` and every nested page beneath it (`cards/new`, `cards/[id]/edit`,
`cards/[id]/play`) — no per-route error files needed.

Behavior:

- Client component (`error.tsx` files are always client components per Next.js
  convention — they receive `{ error, reset }` as props).
- Renders an on-brand `Card` with `role="alert"` and generic copy ("Something went
  wrong") — never surfaces the raw error message, since it could leak Firestore
  internals. The actual `error` object is logged via `console.error` client-side (an
  error boundary in production would otherwise swallow it silently).
- Two actions:
  - **Try again** — calls Next's `reset()` to re-render the segment.
  - **Back to your cards** — link to `/dashboard`. Hidden when `usePathname()` is
    already `/dashboard`, so the card list error page doesn't offer a no-op link to
    itself.

**Known limitation, not fixed here:** Next's `error.tsx` cannot catch errors thrown by
`dashboard/layout.tsx` itself — only by its children. This is fine today because
`getUser()` (called from the layout) already fails safe, returning `null` instead of
throwing (see `src/lib/auth.ts`). Flagging this as a boundary for future awareness, not
something to address in this change.

## Testing

- **`loading.tsx` files and the builder skeleton are static markup** — no conditional
  logic, so no test value. Verified manually (see below).
- **`error.tsx` has real logic** (conditional link visibility, `reset()` wiring), so it
  gets a component test with Vitest + Testing Library
  (`src/app/dashboard/error.test.tsx`), consistent with the existing
  `bingo-celebration.test.tsx` pattern. Covers: renders the generic message (not the raw
  error text), calls `reset()` when "Try again" is clicked, and hides "Back to your
  cards" when `usePathname()` reports `/dashboard`.
- **Manual verification in the browser** for all four loading skeletons and the error
  page's visual appearance (temporarily throwing in a page/forcing a slow network to
  observe the Suspense fallback).

## Out of scope

- A root-level `global-error.tsx`. Nothing in `RootLayout` or `dashboard/layout.tsx`
  can currently throw (`getUser()` fails safe), so there's no realistic failure mode for
  it to catch yet.
- Changes to the root `not-found.tsx`. It already exists and correctly catches
  `notFound()` calls from the edit/play pages; it renders without the dashboard's
  header/nav chrome, which is a pre-existing tradeoff outside this issue's scope.
- Any change to per-component loading/error handling that's already implemented well
  (`bingo-grid.tsx`'s pending/error states, `completion-history-modal.tsx`'s own
  load/save states, `review-step.tsx`'s save-pending state).
