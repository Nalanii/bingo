# Delightful Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a consistent, tasteful layer of micro-interactions and transitions across route changes, dialogs, the card builder, loading skeletons, and empty states — subtle & snappy (150–250ms), respecting `prefers-reduced-motion`.

**Architecture:** Pure CSS. A small set of shared `@keyframes` and one `.skeleton` utility class added to `src/app/globals.css`, applied via Tailwind's existing arbitrary-property animation syntax (`[animation:name_duration_easing]`, already used in `dashboard/page.tsx`'s wobble emoji and `bingo-celebration.tsx`). One new shared hook (`useExitAnimation`) lets `ConfirmDialog`/`CompletionHistoryModal` play a CSS exit animation before their parent unmounts them. One new client component (`PageTransition`) re-keys dashboard route content by pathname so navigations fade+slide in.

**Tech Stack:** Next.js 16 App Router, React, Tailwind CSS v4, Vitest + Testing Library (existing stack — no new dependencies).

**Reference:** `docs/superpowers/specs/2026-08-09-delightful-animations-design.md`

**Two adjustments from the spec, made for accuracy while implementing (documented here per writing-plans self-review):**
1. `PageTransition` is wired into `dashboard/layout.tsx`'s `<main>` only, not the root layout. Wrapping the root layout too would double-animate every dashboard navigation (the sticky header would replay too) since `dashboard/layout.tsx` output is itself part of root layout's `children`. The signed-out landing page (`/`) has no sub-navigation, so it doesn't need a route-transition wrapper.
2. `square-entry-step.tsx` has no discrete "square saved" action — all square rows exist upfront, seeded from the grid size chosen in step 1. Task 8 below gives the rows a staggered entrance animation when the step first mounts instead, which delivers the same "positive confirmation feedback" the spec described, matching what the component actually does.

**Already covered by earlier commits, so not re-touched here:** the spec's "interactive elements" section calls out dashboard card-list hover, `Switch`, and `Tooltip` — all three already have the exact hover/focus transition treatment described (`hover:-translate-y-1` on cards, `transition-colors`/`transition-transform` on `Switch`, fade+scale on `Tooltip`), landed in earlier commits (`e97065e`, prior work on `switch.tsx`/`tooltip.tsx`). Only `Input` (Task 8) and the two dialogs (Tasks 3–4) needed new work in that area.

---

### Task 1: Shared animation primitives in `globals.css`

**Files:**
- Modify: `src/app/globals.css:159-160` (insert before the closing `.font-display` rule)

- [ ] **Step 1: Add the new keyframes, `.skeleton` utility, and reduced-motion guard**

Insert this block into `src/app/globals.css`, immediately after the existing `blackout-glow` keyframes block (after line 159, before the `.font-display` rule):

```css
/* Generic entrance/exit for content that fades without moving (dialog
   overlays, empty states). */
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* Content that slides up slightly while fading in — used for route/step
   transitions. */
@keyframes slide-up-fade {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Confirmation "pop" for a freshly-opened dialog. */
@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pop-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.92);
  }
}

/* Shimmer sweep for skeleton loading blocks. */
@keyframes shimmer {
  0% {
    background-position: -150% 0;
  }
  100% {
    background-position: 150% 0;
  }
}

.skeleton {
  background-image: linear-gradient(
    90deg,
    var(--color-muted) 25%,
    color-mix(in srgb, var(--color-muted) 60%, white) 50%,
    var(--color-muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

/* Respect the OS-level reduced-motion preference for every animation and
   transition in the app (including the celebration keyframes above) by
   collapsing durations to effectively zero rather than disabling them
   outright — this still fires animationend/transitionend listeners that
   code may depend on. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify the build picks up the new CSS**

Run: `npm run build`
Expected: build succeeds with no CSS errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add shared animation primitives and reduced-motion guard

Assisted by Claude."
```

---

### Task 2: `useExitAnimation` hook

**Files:**
- Create: `src/lib/use-exit-animation.ts`
- Test: `src/lib/use-exit-animation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExitAnimation } from "./use-exit-animation";

describe("useExitAnimation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in the open state", () => {
    const { result } = renderHook(() => useExitAnimation(150));
    expect(result.current.state).toBe("open");
  });

  it("switches to closing immediately but delays the callback", () => {
    const { result } = renderHook(() => useExitAnimation(150));
    const callback = vi.fn();

    act(() => {
      result.current.requestClose(callback);
    });

    expect(result.current.state).toBe("closing");
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores a second requestClose call while already closing", () => {
    const { result } = renderHook(() => useExitAnimation(150));
    const first = vi.fn();
    const second = vi.fn();

    act(() => {
      result.current.requestClose(first);
    });
    act(() => {
      result.current.requestClose(second);
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/use-exit-animation.test.ts`
Expected: FAIL — `Cannot find module './use-exit-animation'`

- [ ] **Step 3: Write the implementation**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_EXIT_DURATION_MS = 150;

export type ExitAnimationState = "open" | "closing";

/**
 * Lets a conditionally-rendered overlay/dialog play a CSS exit animation
 * before it actually goes away. The parent still owns whether the component
 * is mounted at all (e.g. `{show && <ConfirmDialog ... />}`) — this hook
 * only delays the component's own calls to its close callbacks
 * (`onCancel`/`onConfirm`/`onClose`) by `durationMs`, so there's time for a
 * `data-state="closing"` CSS animation to play before the parent unmounts
 * it.
 */
export function useExitAnimation(durationMs: number = DEFAULT_EXIT_DURATION_MS) {
  const [state, setState] = useState<ExitAnimationState>("open");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function requestClose(callback: () => void) {
    if (state === "closing") return;
    setState("closing");
    timeoutRef.current = setTimeout(callback, durationMs);
  }

  return { state, requestClose };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/use-exit-animation.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-exit-animation.ts src/lib/use-exit-animation.test.ts
git commit -m "feat: add useExitAnimation hook for dialog exit animations

Assisted by Claude."
```

---

### Task 3: Wire exit animation into `ConfirmDialog`

**Files:**
- Modify: `src/components/confirm-dialog.tsx`
- Test: `src/components/confirm-dialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays onCancel until the exit animation finishes, flagging data-state in the meantime", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        ariaLabel="Discard changes?"
        message="Discard unsaved changes?"
        confirmLabel="Discard"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveAttribute("data-state", "closing");

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("delays onConfirm until the exit animation finishes", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        ariaLabel="Discard changes?"
        message="Discard unsaved changes?"
        confirmLabel="Discard"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    });

    expect(onConfirm).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/confirm-dialog.test.tsx`
Expected: FAIL — clicking Cancel/Discard currently calls `onCancel`/`onConfirm` synchronously, so `not.toHaveBeenCalled()` fails, and there's no `data-state` attribute yet.

- [ ] **Step 3: Update the implementation**

Replace the full contents of `src/components/confirm-dialog.tsx`:

```tsx
"use client";

import { useRef, type ReactNode } from "react";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { useExitAnimation } from "@/lib/use-exit-animation";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  ariaLabel: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Overlay stacking order; bump this when the dialog nests above another dialog. */
  zIndexClassName?: string;
  /** Wires Escape-to-close and Tab focus trapping via useDialogA11y. */
  manageFocus?: boolean;
}

/**
 * Shared alertdialog chrome for confirm/cancel prompts — an overlay plus a
 * centered dialog with a message and two action buttons. Used for
 * destructive or discard-style confirmations that interrupt the user.
 *
 * Plays a brief fade+pop exit animation before calling `onCancel`/
 * `onConfirm`, via `useExitAnimation` — the parent still controls whether
 * this component is mounted at all, but the actual close callback fires
 * `durationMs` after the user acts, giving the CSS animation time to run.
 */
export function ConfirmDialog({
  ariaLabel,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
  zIndexClassName = "z-50",
  manageFocus = true,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { state, requestClose } = useExitAnimation();
  const close = () => requestClose(onCancel);
  useDialogA11y(dialogRef, close);

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-black/50",
        zIndexClassName,
        state === "open"
          ? "[animation:fade-in_150ms_ease-out]"
          : "[animation:fade-out_150ms_ease-in]",
      )}
      onClick={close}
    >
      <div
        ref={manageFocus ? dialogRef : undefined}
        role="alertdialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        data-state={state}
        className={cn(
          "border-border bg-card text-card-foreground mx-4 flex w-full max-w-sm flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4 focus-visible:outline-none",
          state === "open"
            ? "[animation:pop-in_150ms_ease-out]"
            : "[animation:pop-out_150ms_ease-in]",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="border-control-border bg-card text-card-foreground focus-visible:ring-ring focus-visible:ring-offset-background cursor-pointer rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={close}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="border-destructive bg-destructive text-destructive-foreground focus-visible:ring-ring focus-visible:ring-offset-background cursor-pointer rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={() => requestClose(onConfirm)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/confirm-dialog.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/confirm-dialog.tsx src/components/confirm-dialog.test.tsx
git commit -m "feat: animate ConfirmDialog open/close

Assisted by Claude."
```

---

### Task 4: Wire exit animation into `CompletionHistoryModal`

**Files:**
- Modify: `src/components/completion-history-modal.tsx`

`ConfirmDialog` (Task 3) already animates its own open/close, so the nested
discard-confirmation dialog inside this component is covered automatically —
this task only needs to animate the modal's own overlay/dialog and route its
three close paths (backdrop click / ✕ button / successful save) through
`requestClose`.

- [ ] **Step 1: Update the implementation**

Add the import and hook, and thread `requestClose` through the close paths.

In `src/components/completion-history-modal.tsx`, change the import block:

```typescript
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { useExitAnimation } from "@/lib/use-exit-animation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
```

Add the hook and rewrite `attemptClose` (currently around line 62-124):

```typescript
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const { state, requestClose } = useExitAnimation();

  const dialogRef = useRef<HTMLDivElement>(null);
```

```typescript
  /** Closes the modal directly if nothing is dirty, otherwise asks for confirmation first. */
  function attemptClose() {
    if (dirtyEntries.length > 0) {
      setShowDiscardConfirm(true);
      return;
    }
    requestClose(onClose);
  }
```

In `handleSaveAll`, replace the success-path `onClose()` call:

```typescript
      onEntriesChange?.(refreshed.entries);
      requestClose(onClose);
```

In the discard `ConfirmDialog` at the bottom, replace `onConfirm={onClose}`:

```tsx
          onConfirm={() => requestClose(onClose)}
```

Update the outer overlay and dialog `className`s to animate on `state`:

```tsx
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
        state === "open"
          ? "[animation:fade-in_150ms_ease-out]"
          : "[animation:fade-out_150ms_ease-in]",
      )}
      onClick={attemptClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Completion history for ${square.label}`}
        tabIndex={-1}
        data-state={state}
        className={cn(
          "border-border bg-card text-card-foreground mx-4 flex max-h-[80vh] w-fit max-w-sm min-w-[16rem] flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4 focus-visible:outline-none",
          state === "open"
            ? "[animation:pop-in_150ms_ease-out]"
            : "[animation:pop-out_150ms_ease-in]",
        )}
        onClick={(event) => event.stopPropagation()}
      >
```

- [ ] **Step 2: Manually verify in the browser**

Start the dev server, open a card's play page, open a square's completion
history, and confirm: the modal fades+pops in on open; clicking outside or ✕
fades+pops it back out before it disappears; making an edit then closing
shows the (already-animated) discard confirmation on top.

- [ ] **Step 3: Run the existing suite to confirm nothing broke**

Run: `npx vitest run`
Expected: PASS — no existing test imports `CompletionHistoryModal` today, so this is a regression check on the rest of the suite.

- [ ] **Step 4: Commit**

```bash
git add src/components/completion-history-modal.tsx
git commit -m "feat: animate CompletionHistoryModal open/close

Assisted by Claude."
```

---

### Task 5: `PageTransition` component, wired into the dashboard layout

**Files:**
- Create: `src/components/page-transition.tsx`
- Test: `src/components/page-transition.test.tsx`
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";
import { PageTransition } from "./page-transition";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

describe("PageTransition", () => {
  it("renders its children", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    render(
      <PageTransition>
        <p>Hello</p>
      </PageTransition>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("remounts its wrapper when the pathname changes, so the entrance animation replays", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    const { container, rerender } = render(
      <PageTransition>
        <p>Hello</p>
      </PageTransition>,
    );
    const firstWrapper = container.firstElementChild;

    vi.mocked(usePathname).mockReturnValue("/dashboard/cards/new");
    rerender(
      <PageTransition>
        <p>Hello</p>
      </PageTransition>,
    );

    expect(container.firstElementChild).not.toBe(firstWrapper);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/page-transition.test.tsx`
Expected: FAIL — `Cannot find module './page-transition'`

- [ ] **Step 3: Write the implementation**

```tsx
"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps route content in a subtle slide-up-fade that replays whenever the
 * pathname changes, giving dashboard navigations some motion instead of an
 * instant snap. Re-keying by `pathname` forces React to remount the wrapper
 * div, which restarts the CSS animation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="[animation:slide-up-fade_200ms_ease-out]">
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/page-transition.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire it into the dashboard layout**

In `src/app/dashboard/layout.tsx`, add the import:

```typescript
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { PageTransition } from "@/components/page-transition";
```

Replace the `<main>` line:

```tsx
      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <PageTransition>{children}</PageTransition>
      </main>
```

- [ ] **Step 6: Manually verify in the browser**

Start the dev server, sign in, and navigate between `/dashboard`,
`/dashboard/cards/new`, and back. Confirm the main content area fades+slides
up on each navigation while the sticky header stays put (doesn't re-animate).

- [ ] **Step 7: Commit**

```bash
git add src/components/page-transition.tsx src/components/page-transition.test.tsx src/app/dashboard/layout.tsx
git commit -m "feat: animate dashboard route transitions

Assisted by Claude."
```

---

### Task 6: Card builder step transitions

**Files:**
- Modify: `src/app/dashboard/cards/_builder/card-builder.tsx`

- [ ] **Step 1: Wrap each step's returned JSX in an animated, step-keyed div**

In `src/app/dashboard/cards/_builder/card-builder.tsx`, wrap the three
existing `return` statements (step 3, step 2, and the default/step-1 case).
The `key={step}` forces React to remount the wrapper (and therefore replay
the animation) whenever `step` changes — consistent with the existing
comment above this block about each step fully unmounting the others.

Step 3 branch:

```tsx
  if (step === 3) {
    return (
      <div key={step} className="[animation:slide-up-fade_200ms_ease-out]">
        <ReviewStep
          mode={mode}
          settings={settings}
          squares={positionedSquares}
          onBack={() => setStep(2)}
          onSave={onSave}
        />
      </div>
    );
  }
```

Step 2 branch:

```tsx
  if (step === 2) {
    return (
      <div key={step} className="[animation:slide-up-fade_200ms_ease-out]">
        <SquareEntryStep
          settings={settings}
          defaultValues={squares}
          onComplete={(nextSquares) => {
            setSquares(nextSquares);
            if (mode === "edit" && !initialSquares) {
              throw new Error(
                "CardBuilder: mode is 'edit' but initialSquares was not provided",
              );
            }
            const layoutUnchanged =
              mode === "edit" && settings.layout === initialSettings?.layout;
            setPositionedSquares(
              layoutUnchanged && initialSquares
                ? attachExistingPositions(nextSquares, initialSquares)
                : assignPositions(nextSquares, settings),
            );
            setStep(3);
          }}
          onBack={(nextSquares) => {
            setSquares(nextSquares);
            setStep(1);
          }}
        />
      </div>
    );
  }
```

Default (step 1) branch:

```tsx
  return (
    <div key={step} className="[animation:slide-up-fade_200ms_ease-out]">
      <CardSettingsStep
        mode={mode}
        defaultValues={settings}
        onComplete={(nextSettings) => {
          setSettings(nextSettings);
          setStep(2);
        }}
      />
    </div>
  );
```

- [ ] **Step 2: Run the existing builder tests**

Run: `npx vitest run src/app/dashboard/cards/_builder`
Expected: PASS — no existing test targets `CardBuilder` directly; this
confirms the sibling step tests (`review-step.test.tsx`) still pass
unaffected.

- [ ] **Step 3: Manually verify in the browser**

Start the dev server, go through `/dashboard/cards/new`, and confirm each
Next/Back transition between the three steps fades+slides in.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/cards/_builder/card-builder.tsx
git commit -m "feat: animate card builder step transitions

Assisted by Claude."
```

---

### Task 7: Staggered entrance for square rows in `SquareEntryStep`

**Files:**
- Modify: `src/app/dashboard/cards/_builder/square-entry-step.tsx`

- [ ] **Step 1: Add the staggered entrance animation**

In `src/app/dashboard/cards/_builder/square-entry-step.tsx`, update the
mapped row `div` (around line 84-88):

```tsx
        {squares.map((square, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0 last:pb-0 [animation:slide-up-fade_200ms_ease-out_backwards]"
            style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
          >
```

`backwards` fill-mode keeps each row invisible (`opacity: 0`, its
animation's starting state) during its `animation-delay`, instead of
flashing at full opacity before the delayed animation starts. The delay is
capped at 10 rows' worth (`Math.min(index, 10)`) so a 25-square 5×5 grid
doesn't drag the last row's entrance out past ~300ms.

- [ ] **Step 2: Manually verify in the browser**

Start the dev server, go to `/dashboard/cards/new`, pick a grid size, and
confirm the square rows on the next step cascade in with a slight stagger
instead of all appearing at once.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cards/_builder/square-entry-step.tsx
git commit -m "feat: stagger square row entrance in the card builder

Assisted by Claude."
```

---

### Task 8: Input focus transition

**Files:**
- Modify: `src/components/ui/input.tsx`

- [ ] **Step 1: Add a transition for the focus ring**

In `src/components/ui/input.tsx`, add `transition-shadow duration-150` to
the class list (the focus ring is a `box-shadow`, so this animates its
appearance instead of an instant snap):

```tsx
      className={cn(
        "h-11 w-full rounded-[var(--radius-md)] border-2 border-control-border bg-card px-4 text-sm text-card-foreground placeholder:text-muted-foreground transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
```

- [ ] **Step 2: Manually verify in the browser**

Tab into any text input (e.g. the card name field on `/dashboard/cards/new`)
and confirm the focus ring eases in instead of snapping.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "feat: animate input focus ring

Assisted by Claude."
```

---

### Task 9: Skeleton shimmer for loading states

**Files:**
- Modify: `src/app/dashboard/cards/_builder/builder-skeleton.tsx`
- Modify: `src/app/dashboard/loading.tsx`
- Modify: `src/app/dashboard/cards/[id]/play/loading.tsx`

These files are static markup with a mechanical `bg-muted h-* w-*
animate-pulse rounded-*` pattern repeated per block — swap `bg-muted` +
`animate-pulse` for the new `skeleton` utility class (Task 1) everywhere it
appears, keeping every other class (sizing, rounding) unchanged.

- [ ] **Step 1: Update `builder-skeleton.tsx`**

Replace the full contents of `src/app/dashboard/cards/_builder/builder-skeleton.tsx`:

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
        <div className="skeleton h-4 w-32 rounded-[var(--radius-sm)]" />
        <Card>
          <CardHeader>
            <div className="skeleton h-6 w-48 rounded-[var(--radius-sm)]" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="skeleton h-4 w-24 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-11 w-full rounded-[var(--radius-sm)]" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="skeleton h-4 w-20 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-11 w-full rounded-full" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="skeleton h-4 w-40 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-6 w-11 rounded-full" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="skeleton h-4 w-28 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-11 w-full rounded-full" />
            </div>
            <div className="skeleton h-11 w-24 self-end rounded-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `dashboard/loading.tsx`**

Replace the full contents of `src/app/dashboard/loading.tsx`:

```tsx
import { Card, CardContent } from "@/components/ui/card";

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
      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-3">
        <div className="skeleton h-9 w-40 rounded-[var(--radius-sm)]" />
        <div className="skeleton h-11 w-32 rounded-full" />
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="flex flex-col gap-4 py-6">
              <div className="skeleton h-6 w-2/3 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-4 w-1/3 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-2 w-full rounded-full" />
              <div className="flex gap-2">
                <div className="skeleton h-9 flex-1 rounded-full" />
                <div className="skeleton h-9 flex-1 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `cards/[id]/play/loading.tsx`**

Replace the full contents of `src/app/dashboard/cards/[id]/play/loading.tsx`:

```tsx
const SKELETON_GRID_SIZE = 5;

/**
 * Suspense fallback for `/dashboard/cards/[id]/play`, shown while `getCard`
 * and `getCompletions` are in flight. The real grid size (3 or 5) isn't
 * known until the card loads, so this shows a 5×5 grid as a representative
 * default shape.
 */
export default function CardGridLoading() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <p role="status" className="sr-only">
        Loading your card…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="skeleton size-7 rounded-[var(--radius-sm)]" />
          <div className="skeleton h-8 w-2/3 rounded-[var(--radius-sm)]" />
        </div>
        <div
          className="mx-auto grid w-full max-w-xl gap-1.5 sm:gap-2 md:gap-3"
          style={{
            gridTemplateColumns: `repeat(${SKELETON_GRID_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: SKELETON_GRID_SIZE * SKELETON_GRID_SIZE }).map((_, index) => (
            <div
              key={index}
              className="border-border skeleton aspect-square rounded-[var(--radius-sm)] border-2"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

Throttle the network (or add a temporary `await new Promise(r =>
setTimeout(r, 2000))` in one of the pages, then remove it) to observe each
skeleton shimmering instead of pulsing uniform gray blocks. Check
`/dashboard`, `/dashboard/cards/new`, and `/dashboard/cards/[id]/play`.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/cards/_builder/builder-skeleton.tsx src/app/dashboard/loading.tsx "src/app/dashboard/cards/[id]/play/loading.tsx"
git commit -m "feat: shimmer skeleton loaders instead of plain pulse

Assisted by Claude."
```

---

### Task 10: Fade-in for empty states

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/completion-history-modal.tsx`

- [ ] **Step 1: Fade in the dashboard's "No cards yet" card**

In `src/app/dashboard/page.tsx`, update the empty-state `Card`:

```tsx
        <Card className="border-dashed [animation:fade-in_300ms_ease-out]">
```

- [ ] **Step 2: Fade in the completion history's "No completions yet" text**

In `src/components/completion-history-modal.tsx`, update:

```tsx
          {!loading && !loadError && entries && entries.length === 0 && (
            <p className="text-sm [animation:fade-in_300ms_ease-out]">No completions yet.</p>
          )}
```

- [ ] **Step 3: Manually verify in the browser**

Sign in with an account that has zero cards (or temporarily clear the list)
to see the dashboard empty state fade in. Open completion history on a
square with no completions yet to see the same there.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx src/components/completion-history-modal.tsx
git commit -m "feat: fade in empty states

Assisted by Claude."
```

---

### Task 11: Final verification gate

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
Expected: all tests pass, including the new `use-exit-animation.test.ts`,
`confirm-dialog.test.tsx`, and `page-transition.test.tsx`.

```bash
npm run test:e2e
```
Expected: all existing e2e specs pass — the animations here are visual only
and don't change any element's role, label, or interaction outcome, so no
existing e2e assertion should break. If a spec fails because it asserts on
immediate DOM removal of `ConfirmDialog`/`CompletionHistoryModal` after a
click (rather than waiting), that's an expected consequence of the new
150ms exit delay — update that spec to await the element's removal instead
of asserting synchronously.

```bash
npm run build
```
Expected: production build succeeds.

- [ ] **Step 2: Report results**

Summarize pass/fail for each command. If anything failed, fix it before
considering this plan complete — do not skip ahead.
