# Card Settings Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first step of the card builder — a form capturing card name, grid size, free-space toggle, and layout order, with validation and defaults — and a minimal two-step client wizard that hands the captured values to a stub second step, proving the handoff described in [GitHub issue #1](https://github.com/Nalanii/bingo/issues/1).

**Architecture:** Three new presentational UI primitives (`Input`, `SegmentedControl`, `Switch`) added to `src/components/ui/`, following the `cva` + Tailwind-token conventions already used by `button.tsx`. A `"use client"` `CardBuilder` component owns two-state wizard state (`step`, `settings`) with plain `useState`; it renders `CardSettingsStep` (the form) or `SquareEntryStepStub` (placeholder) depending on step. `src/app/dashboard/cards/new/page.tsx` becomes a thin Server Component that authorizes the user (matching the pattern in `src/app/dashboard/page.tsx`) and renders `CardBuilder`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, `class-variance-authority`, `tailwind-merge`/`clsx` via `cn()`.

**Testing note:** This repo has no automated test runner yet (Vitest/Playwright setup is tracked separately in issue #20). Verification in this plan uses `npm run typecheck`, `npm run lint`, `npm run build`, and manual browser checks against the dev server — the same bar the codebase currently holds itself to (see `AGENTS.md`).

---

## File Structure

- Create: `src/components/ui/input.tsx` — styled text input primitive.
- Create: `src/components/ui/segmented-control.tsx` — pill radio-group primitive for 2+ mutually exclusive string options.
- Create: `src/components/ui/switch.tsx` — boolean toggle primitive.
- Create: `src/app/dashboard/cards/new/types.ts` — `CardSettings` type shared by the wizard steps.
- Create: `src/app/dashboard/cards/new/card-builder.tsx` — client wizard shell (state + step switch).
- Create: `src/app/dashboard/cards/new/card-settings-step.tsx` — the settings form (step 1).
- Create: `src/app/dashboard/cards/new/square-entry-step-stub.tsx` — placeholder step 2.
- Modify: `src/app/dashboard/cards/new/page.tsx` — replace the static placeholder with the authorized wrapper around `CardBuilder`.

---

### Task 1: `Input` primitive

**Files:**
- Create: `src/components/ui/input.tsx`

- [ ] **Step 1: Write the component**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-[var(--radius-md)] border-2 border-border bg-card px-4 text-sm text-card-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "feat: add Input UI primitive"
```

---

### Task 2: `SegmentedControl` primitive

**Files:**
- Create: `src/components/ui/segmented-control.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ...props
}: SegmentedControlProps) {
  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + options.length) % options.length;
    onChange(options[nextIndex].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"]}
      className={cn(
        "inline-flex rounded-full border-2 border-border bg-muted p-1",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/segmented-control.tsx
git commit -m "feat: add SegmentedControl UI primitive"
```

---

### Task 3: `Switch` primitive

**Files:**
- Create: `src/components/ui/switch.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  "aria-label"?: string;
  id?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  className,
  id,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={props["aria-label"]}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-primary" : "bg-muted",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-card shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-1",
        )}
      />
    </button>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/switch.tsx
git commit -m "feat: add Switch UI primitive"
```

---

### Task 4: `CardSettings` type + `CardBuilder` wizard shell

**Files:**
- Create: `src/app/dashboard/cards/new/types.ts`
- Create: `src/app/dashboard/cards/new/card-builder.tsx`

This task creates the wizard shell before its child steps exist, so it will not compile until Task 5 and Task 6 land. That's expected — do not run typecheck until Task 6 is done. Commit all three (Task 4 + 5 + 6) files together at the end of Task 6 instead of separately.

- [ ] **Step 1: Write the shared type**

```ts
export type CardSettings = {
  name: string;
  gridSize: 3 | 5;
  hasFreeSpace: boolean;
  layout: "RANDOM" | "SET";
};
```

- [ ] **Step 2: Write the wizard shell**

```tsx
"use client";

import * as React from "react";
import { CardSettingsStep } from "./card-settings-step";
import { SquareEntryStepStub } from "./square-entry-step-stub";
import type { CardSettings } from "./types";

const DEFAULT_SETTINGS: CardSettings = {
  name: "",
  gridSize: 5,
  hasFreeSpace: true,
  layout: "RANDOM",
};

export function CardBuilder() {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [settings, setSettings] = React.useState<CardSettings>(DEFAULT_SETTINGS);

  if (step === 2) {
    return (
      <SquareEntryStepStub settings={settings} onBack={() => setStep(1)} />
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

(No verify/commit step here — see Task 6.)

---

### Task 5: `CardSettingsStep` (the settings form)

**Files:**
- Create: `src/app/dashboard/cards/new/card-settings-step.tsx`

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
import { Switch } from "@/components/ui/switch";
import type { CardSettings } from "./types";

const NAME_MAX_LENGTH = 128;

export function CardSettingsStep({
  defaultValues,
  onComplete,
}: {
  defaultValues: CardSettings;
  onComplete: (settings: CardSettings) => void;
}) {
  const [name, setName] = React.useState(defaultValues.name);
  const [gridSize, setGridSize] = React.useState(defaultValues.gridSize);
  const [hasFreeSpace, setHasFreeSpace] = React.useState(
    defaultValues.hasFreeSpace,
  );
  const [layout, setLayout] = React.useState(defaultValues.layout);
  const [nameError, setNameError] = React.useState<string | null>(null);

  const handleNext = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Give your card a name");
      return;
    }
    onComplete({ name: trimmedName, gridSize, hasFreeSpace, layout });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Build a new card 🎲</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="card-name" className="text-sm font-semibold">
            Card name
          </label>
          <Input
            id="card-name"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Summer bucket list"
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
          />
          {nameError ? (
            <p className="text-sm text-primary">{nameError}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Grid size</span>
          <SegmentedControl
            aria-label="Grid size"
            value={String(gridSize)}
            onChange={(value) => setGridSize(value === "3" ? 3 : 5)}
            options={[
              { value: "3", label: "3×3" },
              { value: "5", label: "5×5" },
            ]}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <label htmlFor="free-space" className="text-sm font-semibold">
            Free space in the center
          </label>
          <Switch
            id="free-space"
            checked={hasFreeSpace}
            onChange={setHasFreeSpace}
            aria-label="Free space in the center"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Square order</span>
          <SegmentedControl
            aria-label="Square order"
            value={layout}
            onChange={(value) => setLayout(value === "SET" ? "SET" : "RANDOM")}
            options={[
              { value: "RANDOM", label: "Random" },
              { value: "SET", label: "Set" },
            ]}
          />
        </div>

        <Button onClick={handleNext} className="self-end">
          Next
        </Button>
      </CardContent>
    </Card>
  );
}
```

(No verify/commit step here — see Task 6.)

---

### Task 6: `SquareEntryStepStub` + wire up + verify

**Files:**
- Create: `src/app/dashboard/cards/new/square-entry-step-stub.tsx`
- Modify: `src/app/dashboard/cards/new/page.tsx`

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
import type { CardSettings } from "./types";

export function SquareEntryStepStub({
  settings,
  onBack,
}: {
  settings: CardSettings;
  onBack: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Square entry (coming soon) 🚧</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          Card &ldquo;{settings.name}&rdquo; · {settings.gridSize}×
          {settings.gridSize} · free space{" "}
          {settings.hasFreeSpace ? "on" : "off"} ·{" "}
          {settings.layout === "RANDOM" ? "random" : "set"} order
        </p>
        <p className="text-sm text-muted-foreground">
          Filling in each square is tracked in issue #2.
        </p>
        <Button variant="outline" onClick={onBack} className="self-start">
          ← Back
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Replace the placeholder page**

Replace the full contents of `src/app/dashboard/cards/new/page.tsx` (currently a static placeholder Card) with:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { CardBuilder } from "./card-builder";

export default async function NewCardPage() {
  const user = await getUser();
  // getUser() is guaranteed by middleware, but the proxy's revocation check is
  // weaker than getUser()'s, so a revoked-but-unexpired cookie can still reach
  // here. Redirect defensively instead of silently rendering an empty state.
  if (!user) redirect("/");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        ← Back to your cards
      </Link>
      <CardBuilder />
    </div>
  );
}
```

- [ ] **Step 3: Verify everything compiles and lints**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit all wizard files together**

```bash
git add src/app/dashboard/cards/new/types.ts src/app/dashboard/cards/new/card-builder.tsx src/app/dashboard/cards/new/card-settings-step.tsx src/app/dashboard/cards/new/square-entry-step-stub.tsx src/app/dashboard/cards/new/page.tsx
git commit -m "feat: add card settings step to the card builder"
```

---

### Task 7: Manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds with no type or lint errors.

- [ ] **Step 2: Manual browser walkthrough**

Start the dev server (`npm run dev`) and, signed in, navigate to `/dashboard/cards/new`. Confirm:
- Form loads with defaults: empty name, 5×5 selected, free space on, Random selected.
- Clicking "Next" with an empty name shows the "Give your card a name" error and does not advance.
- Typing a name clears the error.
- Changing grid size to 3×3, toggling free space off, and selecting "Set" order, then clicking "Next" advances to the stub step showing all four values correctly reflected (including "3×3", "free space off", "set order").
- Clicking "← Back" returns to the form with the previously entered values still populated (name, 3×3, free space off, Set).
- Repeat at a mobile viewport width (e.g. 375px) to confirm the segmented controls and switch remain usable and don't overflow.

- [ ] **Step 3: Confirm no regressions in the dashboard list**

Navigate to `/dashboard` and confirm the "+ New card" / "Create a card" links still route to `/dashboard/cards/new` and the existing card list still renders (this task didn't touch `dashboard/page.tsx`, but the shared layout wraps both).

No commit for this task — it's verification only. If any step fails, fix the relevant file from Tasks 1–6 and re-run.
