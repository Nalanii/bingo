# Loading, Empty, and Error States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the four async `/dashboard` routes (card list, builder create, builder
edit, play grid) proper Next.js `loading.tsx` skeletons and a shared `error.tsx`
boundary, so a slow Firestore read shows on-brand shape-matched placeholders instead of
a blank screen, and an unhandled Firestore error shows a friendly recovery card instead
of Next's generic error page.

**Architecture:** Pure additive use of Next.js App Router file conventions —
`loading.tsx` files automatically wrap their route segment's `page.tsx` in a Suspense
boundary, and `error.tsx` is a React error boundary Next.js mounts automatically for
its segment and everything nested under it. No existing page files change. One shared
skeleton component covers both builder routes (create + edit) since they render the
same first step.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (`animate-pulse`),
existing `src/components/ui` primitives (`Card`, `Button`, `buttonVariants`), Vitest +
Testing Library for the one component with real logic (`error.tsx`).

Reference: design doc at
`docs/superpowers/specs/2026-08-04-loading-empty-error-states-design.md`.

## Global Constraints

- Mobile and desktop must both work — reuse the same responsive classes the real pages
  already use (e.g. `sm:grid-cols-2 lg:grid-cols-3` for the card grid), don't invent new
  breakpoints.
- Use the semantic design tokens already in `src/app/globals.css` (`bg-muted`,
  `border-border`, `rounded-[var(--radius-lg)]`, `rounded-[var(--radius-sm)]`) — no raw
  hex colors.
- Decorative/placeholder content must be `aria-hidden="true"`; every loading view needs
  an sr-only `role="status"` announcement, placed as a sibling of (not nested inside)
  the `aria-hidden` block — nesting `role="status"` inside an `aria-hidden` ancestor
  removes it from the accessibility tree.
- Never surface a raw thrown error's message to the user — log it via `console.error`
  and show generic copy instead.
- Conventional Commits for every commit message.
- Before considering the whole plan done: `npm run lint && npm run typecheck && npm run
  build` must all pass.

---

### Task 1: Dashboard card-list loading skeleton

**Files:**
- Create: `src/app/dashboard/loading.tsx`

**Interfaces:**
- Consumes: nothing project-specific — plain React/JSX, Tailwind classes only.
- Produces: nothing consumed by later tasks (independent of every other task in this
  plan).

This is static markup (no props, no logic), so there's no automated test — verify by
reading the rendered shape against `src/app/dashboard/page.tsx`'s real layout, and by
`lint`/`typecheck`/`build` passing.

- [ ] **Step 1: Write the skeleton**

Create `src/app/dashboard/loading.tsx`:

```tsx
/**
 * Suspense fallback for the `/dashboard` card list, shown while
 * `listCardsByOwner`/`getCompletions` are in flight. Shape-matches the real
 * layout in `page.tsx` (title/button bar + a grid of card tiles) so there's
 * no layout shift once the real content arrives.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        Loading your cards…
      </p>
      <div
        aria-hidden="true"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="h-9 w-40 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
        <div className="h-11 w-32 animate-pulse rounded-full bg-muted" />
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-4 rounded-[var(--radius-lg)] border-2 border-border bg-card p-6"
          >
            <div className="h-6 w-2/3 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
            <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
            <div className="flex gap-2">
              <div className="h-9 flex-1 animate-pulse rounded-full bg-muted" />
              <div className="h-9 flex-1 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/loading.tsx
git commit -m "feat: add loading skeleton for the dashboard card list"
```

---

### Task 2: Shared builder skeleton (create + edit loading states)

**Files:**
- Create: `src/app/dashboard/cards/_builder/builder-skeleton.tsx`
- Create: `src/app/dashboard/cards/new/loading.tsx`
- Create: `src/app/dashboard/cards/[id]/edit/loading.tsx`

**Interfaces:**
- Consumes: `Card`, `CardHeader`, `CardContent` from `@/components/ui/card` (existing,
  see `src/components/ui/card.tsx`).
- Produces: `BuilderSkeleton` (named export, no props) from
  `src/app/dashboard/cards/_builder/builder-skeleton.tsx`, imported by both `loading.tsx`
  files below.

Static markup, no automated test — verify by shape-matching against
`src/app/dashboard/cards/_builder/card-settings-step.tsx` (the first builder step both
routes land on) and by `lint`/`typecheck`/`build` passing.

- [ ] **Step 1: Write the shared skeleton component**

Create `src/app/dashboard/cards/_builder/builder-skeleton.tsx`:

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Shape-matched loading skeleton for the card builder's first step
 * (`CardSettingsStep`), shared by the create (`cards/new`) and edit
 * (`cards/[id]/edit`) routes' `loading.tsx` files — both land on that step
 * first, so one skeleton covers both.
 */
export function BuilderSkeleton() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="h-4 w-32 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
        <Card>
          <CardHeader>
            <div className="h-6 w-48 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="h-4 w-24 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
              <div className="h-11 w-full animate-pulse rounded-[var(--radius-sm)] bg-muted" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-20 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
              <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-40 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-28 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
              <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
            </div>
            <div className="h-11 w-24 animate-pulse self-end rounded-full bg-muted" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire up the create route's loading state**

Create `src/app/dashboard/cards/new/loading.tsx`:

```tsx
import { BuilderSkeleton } from "../_builder/builder-skeleton";

export default function NewCardLoading() {
  return <BuilderSkeleton />;
}
```

- [ ] **Step 3: Wire up the edit route's loading state**

Create `src/app/dashboard/cards/[id]/edit/loading.tsx`:

```tsx
import { BuilderSkeleton } from "../../_builder/builder-skeleton";

export default function EditCardLoading() {
  return <BuilderSkeleton />;
}
```

- [ ] **Step 4: Verify types and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/cards/_builder/builder-skeleton.tsx src/app/dashboard/cards/new/loading.tsx "src/app/dashboard/cards/[id]/edit/loading.tsx"
git commit -m "feat: add loading skeleton for the card builder"
```

---

### Task 3: Play-grid loading skeleton

**Files:**
- Create: `src/app/dashboard/cards/[id]/play/loading.tsx`

**Interfaces:**
- Consumes: nothing project-specific — plain React/JSX, Tailwind classes only. Grid
  cell classes are copied from `src/components/bingo-grid.tsx`'s real grid
  (`mx-auto grid w-full max-w-xl gap-1.5 sm:gap-2 md:gap-3`,
  `style={{ gridTemplateColumns: ... }}`) so the skeleton lines up with the real grid
  once it mounts.
- Produces: nothing consumed by later tasks (independent of every other task in this
  plan).

Static markup, no automated test — verify by shape-matching against
`src/components/bingo-grid.tsx` and by `lint`/`typecheck`/`build` passing.

- [ ] **Step 1: Write the skeleton**

Create `src/app/dashboard/cards/[id]/play/loading.tsx`:

```tsx
const SKELETON_GRID_SIZE = 5;

/**
 * Suspense fallback for `/dashboard/cards/[id]/play`, shown while `getCard`
 * and `getCompletions` are in flight. The real grid size (3 or 5) isn't
 * known until the card loads, so this shows a 5×5 grid as a representative
 * default shape.
 */
export default function PlayCardLoading() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <p role="status" className="sr-only">
        Loading your card…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="h-4 w-32 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
        <div className="h-8 w-2/3 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
        <div
          className="mx-auto grid w-full max-w-xl gap-1.5 sm:gap-2 md:gap-3"
          style={{
            gridTemplateColumns: `repeat(${SKELETON_GRID_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: SKELETON_GRID_SIZE * SKELETON_GRID_SIZE }).map(
            (_, index) => (
              <div
                key={index}
                className="aspect-square animate-pulse rounded-[var(--radius-sm)] border-2 border-border bg-muted"
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/dashboard/cards/[id]/play/loading.tsx"
git commit -m "feat: add loading skeleton for the play grid"
```

---

### Task 4: Shared dashboard error boundary

**Files:**
- Create: `src/app/dashboard/error.tsx`
- Test: `src/app/dashboard/error.test.tsx`

**Interfaces:**
- Consumes: `Button`, `buttonVariants` from `@/components/ui/button`; `Card`,
  `CardContent`, `CardTitle` from `@/components/ui/card` (existing, see
  `src/components/ui/button.tsx` and `src/components/ui/card.tsx`); `usePathname` from
  `next/navigation`; `Link` from `next/link`.
- Produces: default export `DashboardError({ error, reset }: { error: Error & {
  digest?: string }; reset: () => void })`, the Next.js `error.tsx` convention — no
  other task imports it directly (Next.js mounts it automatically for the `dashboard`
  segment and everything nested under it: the card list, and the create/edit/play
  routes).

This is the one file in this plan with real conditional logic (hide the "Back to your
cards" link when already on `/dashboard`, wire up `reset()`), so it gets a proper
Vitest + Testing Library test, following the pattern in
`src/components/bingo-celebration.test.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/error.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";
import DashboardError from "./error";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: import("react").ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("DashboardError", () => {
  it("shows generic copy, never the raw error message", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/cards/new");
    render(
      <DashboardError
        error={new Error("permission-denied: missing composite index")}
        reset={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We hit a snag loading this page. Give it another try.",
    );
    expect(screen.queryByText(/permission-denied/)).not.toBeInTheDocument();
  });

  it("calls reset() when Try again is clicked", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/cards/new");
    const reset = vi.fn();
    render(<DashboardError error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("shows a link back to the dashboard when not already there", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/cards/new");
    render(<DashboardError error={new Error("boom")} reset={vi.fn()} />);

    const link = screen.getByRole("link", { name: "Back to your cards" });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("hides the back-to-dashboard link when already on the dashboard", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    render(<DashboardError error={new Error("boom")} reset={vi.fn()} />);

    expect(
      screen.queryByRole("link", { name: "Back to your cards" }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/dashboard/error.test.tsx`
Expected: FAIL — `src/app/dashboard/error.tsx` doesn't exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `src/app/dashboard/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

/**
 * Error boundary for the whole `/dashboard` segment — Next.js mounts this
 * automatically for the card list and every nested route (builder
 * create/edit, play grid), so an unhandled Firestore error anywhere in
 * those pages lands here instead of Next's generic error page.
 *
 * Never renders the raw `error.message` (it may contain Firestore/internal
 * details); it's only logged to the console.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error("Dashboard error boundary caught:", error);
  }, [error]);

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <span aria-hidden="true" className="text-5xl">
          😵
        </span>
        <div>
          <CardTitle>Something went wrong</CardTitle>
          <p role="alert" className="mt-1 text-muted-foreground">
            We hit a snag loading this page. Give it another try.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          {pathname !== "/dashboard" && (
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Back to your cards
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/dashboard/error.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify types and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/error.tsx src/app/dashboard/error.test.tsx
git commit -m "feat: add error boundary for the dashboard"
```

---

## Final verification (after all four tasks land)

- [ ] Run the full check sequence: `npm run lint && npm run typecheck && npm run build`
  — all three must pass with all four routes' new files in place.
- [ ] Run the full test suite: `npm run test` — all tests pass, including the new
  `error.test.tsx`.
- [ ] Manual visual check in the browser (ask before starting a dev server): throttle
  the network or add a temporary `await new Promise(r => setTimeout(r, 3000))` in one
  data-fetching page to confirm each skeleton renders correctly, then temporarily
  `throw new Error("test")` in a page to confirm the error card renders with working
  "Try again" and "Back to your cards" actions — remove both temporary changes
  afterward.
