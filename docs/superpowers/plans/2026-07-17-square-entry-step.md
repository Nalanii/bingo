# Square Entry Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the second step of the card builder — a form letting the user set a label, type (CHECK/COUNTER), and counter goal for every non-free-space square — replacing the `SquareEntryStepStub` placeholder, and hand the captured values to a new step-3 review stub, per [GitHub issue #2](https://github.com/Nalanii/bingo/issues/2).

**Architecture:** A new `SquareEntryStep` client component renders one row per square (`Input` for label, `SegmentedControl` for kind, conditional numeric `Input` for goal), seeding its local state from a `defaultValues: SquareDraft[]` prop the same way `CardSettingsStep` seeds from `defaultValues: CardSettings` — following the existing unmount-per-step invariant in `CardBuilder`. `CardBuilder` grows a third step and a `squares` state slot. `SquareEntryStepStub` is deleted and replaced by `SquareEntryStep`; a new `ReviewStepStub` becomes the step-3 placeholder (mirroring the step-2 stub it displaces), to be replaced by real persistence in issue #4.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, existing `src/components/ui/` primitives (`Input`, `SegmentedControl`, `Button`, `Card`).

**Testing note:** This repo has no automated test runner yet (Vitest/Playwright setup is tracked separately in issue #20). Verification in this plan uses `npm run typecheck`, `npm run lint`, `npm run build`, and manual browser checks against the dev server — the same bar `docs/superpowers/plans/2026-07-17-card-settings-step.md` used for issue #1.

---

## File Structure

- Modify: `src/app/dashboard/cards/new/types.ts` — add `SquareDraft` type.
- Create: `src/app/dashboard/cards/new/square-entry-step.tsx` — the square-entry form (step 2), replaces the stub.
- Delete: `src/app/dashboard/cards/new/square-entry-step-stub.tsx` — superseded by the above.
- Create: `src/app/dashboard/cards/new/review-step-stub.tsx` — placeholder step 3.
- Modify: `src/app/dashboard/cards/new/card-builder.tsx` — three-step wizard, `squares` state, wire up new components.

---

### Task 1: `SquareDraft` type

**Files:**
- Modify: `src/app/dashboard/cards/new/types.ts`

- [ ] **Step 1: Add the type**

Replace the full contents of `src/app/dashboard/cards/new/types.ts` with:

```ts
import type { SquareKind } from "@/lib/firestore/cards";

export type CardSettings = {
  name: string;
  gridSize: 3 | 5;
  hasFreeSpace: boolean;
  layout: "RANDOM" | "SET";
};

export type SquareDraft = {
  label: string;
  kind: SquareKind;
  goal: number;
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cards/new/types.ts
git commit -m "feat: add SquareDraft type for square entry"
```

---

### Task 2: `SquareEntryStep` component

**Files:**
- Create: `src/app/dashboard/cards/new/square-entry-step.tsx`

This task depends on Task 1's `SquareDraft` type. It will not be wired into the wizard until Task 4 — that's expected, this component is self-contained and can be typechecked on its own once Task 1 lands.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { CardSettings, SquareDraft } from "./types";

const LABEL_MAX_LENGTH = 128;
const DEFAULT_GOAL = 2;

function squareCount(settings: CardSettings): number {
  return (
    settings.gridSize * settings.gridSize - (settings.hasFreeSpace ? 1 : 0)
  );
}

function seedSquares(
  settings: CardSettings,
  defaultValues: SquareDraft[],
): SquareDraft[] {
  const count = squareCount(settings);
  return Array.from({ length: count }, (_, index) => {
    const existing = defaultValues[index];
    return existing
      ? { ...existing }
      : { label: "", kind: "CHECK" as const, goal: 1 };
  });
}

export function SquareEntryStep({
  settings,
  defaultValues,
  onComplete,
  onBack,
}: {
  settings: CardSettings;
  defaultValues: SquareDraft[];
  onComplete: (squares: SquareDraft[]) => void;
  onBack: (squares: SquareDraft[]) => void;
}) {
  const [squares, setSquares] = React.useState<SquareDraft[]>(() =>
    seedSquares(settings, defaultValues),
  );
  const [errorIndex, setErrorIndex] = React.useState<number | null>(null);
  const labelRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  const updateSquare = (index: number, patch: Partial<SquareDraft>) => {
    setSquares((prev) =>
      prev.map((square, i) => (i === index ? { ...square, ...patch } : square)),
    );
    if (errorIndex === index) setErrorIndex(null);
  };

  const handleKindChange = (index: number, value: string) => {
    if (value === "COUNTER") {
      updateSquare(index, { kind: "COUNTER", goal: DEFAULT_GOAL });
    } else {
      updateSquare(index, { kind: "CHECK", goal: 1 });
    }
  };

  const handleNext = () => {
    const firstEmpty = squares.findIndex((square) => !square.label.trim());
    if (firstEmpty !== -1) {
      setErrorIndex(firstEmpty);
      labelRefs.current[firstEmpty]?.focus();
      return;
    }
    onComplete(
      squares.map((square) => ({ ...square, label: square.label.trim() })),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fill in your squares 📝</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {squares.map((square, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0 last:pb-0"
          >
            <span className="text-sm font-semibold">Square {index + 1}</span>
            <Input
              ref={(el) => {
                labelRefs.current[index] = el;
              }}
              value={square.label}
              maxLength={LABEL_MAX_LENGTH}
              placeholder="Do something bingo-worthy"
              aria-label={`Square ${index + 1} label`}
              onChange={(event) =>
                updateSquare(index, { label: event.target.value })
              }
            />
            {errorIndex === index ? (
              <p className="text-sm text-primary">Give this square a label</p>
            ) : null}
            <div className="flex items-center gap-4">
              <SegmentedControl
                aria-label={`Square ${index + 1} type`}
                value={square.kind}
                onChange={(value) => handleKindChange(index, value)}
                options={[
                  { value: "CHECK", label: "Check" },
                  { value: "COUNTER", label: "Counter" },
                ]}
              />
              {square.kind === "COUNTER" ? (
                <Input
                  type="number"
                  min={2}
                  value={square.goal}
                  aria-label={`Square ${index + 1} goal`}
                  className="w-20"
                  onChange={(event) =>
                    updateSquare(index, {
                      goal: Math.max(2, Number(event.target.value) || 2),
                    })
                  }
                />
              ) : null}
            </div>
          </div>
        ))}

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => onBack(squares)}
            className="self-start"
          >
            ← Back
          </Button>
          <Button onClick={handleNext} className="self-end">
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors. (If `Input` doesn't yet forward a `ref` usable this way, confirm against `src/components/ui/input.tsx` — it's built with `React.forwardRef`, so passing `ref` as a prop works.)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cards/new/square-entry-step.tsx
git commit -m "feat: add square entry form for the card builder"
```

---

### Task 3: `ReviewStepStub` component

**Files:**
- Create: `src/app/dashboard/cards/new/review-step-stub.tsx`

- [ ] **Step 1: Write the stub step**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CardSettings, SquareDraft } from "./types";

export function ReviewStepStub({
  settings,
  squares,
  onBack,
}: {
  settings: CardSettings;
  squares: SquareDraft[];
  onBack: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review (coming soon) 🚧</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          Card &ldquo;{settings.name}&rdquo; · {settings.gridSize}×
          {settings.gridSize} · free space{" "}
          {settings.hasFreeSpace ? "on" : "off"} ·{" "}
          {settings.layout === "RANDOM" ? "random" : "set"} order
        </p>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {squares.map((square, index) => (
            <li key={index}>
              {index + 1}. {square.label} ·{" "}
              {square.kind === "COUNTER"
                ? `counter to ${square.goal}`
                : "check"}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Saving is tracked in issue #4.
        </p>
        <Button variant="outline" onClick={onBack} className="self-start">
          ← Back
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/cards/new/review-step-stub.tsx
git commit -m "feat: add review step stub to the card builder"
```

---

### Task 4: Wire up `CardBuilder` and delete the old stub

**Files:**
- Modify: `src/app/dashboard/cards/new/card-builder.tsx`
- Delete: `src/app/dashboard/cards/new/square-entry-step-stub.tsx`

- [ ] **Step 1: Delete the old stub**

```bash
git rm src/app/dashboard/cards/new/square-entry-step-stub.tsx
```

- [ ] **Step 2: Replace the wizard shell**

Replace the full contents of `src/app/dashboard/cards/new/card-builder.tsx` with:

```tsx
"use client";

import * as React from "react";
import { CardSettingsStep } from "./card-settings-step";
import { ReviewStepStub } from "./review-step-stub";
import { SquareEntryStep } from "./square-entry-step";
import type { CardSettings, SquareDraft } from "./types";

const DEFAULT_SETTINGS: CardSettings = {
  name: "",
  gridSize: 5,
  hasFreeSpace: true,
  layout: "RANDOM",
};

export function CardBuilder() {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [settings, setSettings] = React.useState<CardSettings>(DEFAULT_SETTINGS);
  const [squares, setSquares] = React.useState<SquareDraft[]>([]);

  // Each step fully unmounts the others (rather than hiding them), so every
  // step always remounts fresh from the latest lifted state (`settings`,
  // `squares`) when navigating — keep it that way, or a step's
  // defaultValues-seeded local state will go stale.
  if (step === 3) {
    return (
      <ReviewStepStub
        settings={settings}
        squares={squares}
        onBack={() => setStep(2)}
      />
    );
  }

  if (step === 2) {
    return (
      <SquareEntryStep
        settings={settings}
        defaultValues={squares}
        onComplete={(nextSquares) => {
          setSquares(nextSquares);
          setStep(3);
        }}
        onBack={(nextSquares) => {
          setSquares(nextSquares);
          setStep(1);
        }}
      />
    );
  }

  return (
    <CardSettingsStep
      defaultValues={settings}
      onComplete={(nextSettings) => {
        setSettings(nextSettings);
        setStep(2);
      }}
    />
  );
}
```

- [ ] **Step 3: Verify everything compiles and lints**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/cards/new/card-builder.tsx
git commit -m "feat: wire up square entry step in the card builder"
```

---

### Task 5: Manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds with no type or lint errors.

- [ ] **Step 2: Manual browser walkthrough**

Start the dev server (`npm run dev`) and, signed in, navigate to `/dashboard/cards/new`. Confirm:
- Fill in the step-1 form (any name, keep defaults: 5×5, free space on, Random) and click "Next".
- Step 2 shows 24 square rows (25 minus the free-space square). Each row has an empty label input and defaults to "Check" with no goal input visible.
- Clicking "Next" with any label still empty shows "Give this square a label" under the first empty row and focuses it; does not advance.
- Fill in all 24 labels. Switch a few rows to "Counter" — confirm a goal number input appears, defaulting to 2, and that it won't go below 2 (try typing 1 or 0, or clearing it).
- Click "Next" — advances to the review stub listing all 24 squares with correct labels and "check"/"counter to N" tags, plus the step-1 settings summary.
- Click "← Back" from review — returns to step 2 with all labels/types/goals still populated exactly as entered.
- Click "← Back" from square entry — returns to step 1 with the settings still populated; change grid size to 3×3 and click "Next" again — step 2 now shows 8 rows (9 minus free space), with the first 8 previously-entered squares' data reused where indices still overlap.
- Repeat the walkthrough at a mobile viewport width (e.g. 375px) to confirm the rows, segmented controls, and goal input remain usable and don't overflow.

- [ ] **Step 3: Confirm no regressions in step 1**

Re-run the step-1 checks from `docs/superpowers/plans/2026-07-17-card-settings-step.md` Task 7 (empty-name validation, back/forward preserving values) to confirm this change didn't regress the settings step.

No commit for this task — it's verification only. If any step fails, fix the relevant file from Tasks 1–4 and re-run.
