# Square entry step — design

Tracks [GitHub issue #2](https://github.com/Nalanii/bingo/issues/2).

## Goal

Build the second step of the card builder: a form letting the user fill in
a label, type (CHECK/COUNTER), and counter goal for every non-free-space
square on the grid, replacing the `SquareEntryStepStub` placeholder from
issue #1. Values flow forward into a new step-3 review stub, proving
handoff, the same way issue #1 proved handoff into the (now replaced)
step-2 stub.

Persisting the card + squares via Server Action (issue #4), random-layout
shuffle (issue #3), and any drag-to-reorder UI are out of scope. This is
UI + client state only.

## Data shape

```ts
// types.ts
import type { SquareKind } from "@/lib/firestore/cards";

export type SquareDraft = {
  label: string;
  kind: SquareKind; // "CHECK" | "COUNTER"
  goal: number;      // 1 for CHECK, >=2 for COUNTER
};
```

`squares: SquareDraft[]` has one entry per **non-free-space** position —
length `gridSize*gridSize - (hasFreeSpace ? 1 : 0)`. No `id`/`position`/
`isFreeSpace` — assembling the full persisted `Square[]` (with the
free-space slot placed at center) is issue #4's job.

## Wizard state (`src/app/dashboard/cards/new/`)

- `card-builder.tsx` — `step` becomes `1 | 2 | 3`. Adds `squares:
  SquareDraft[]` state, default `[]`. Renders `CardSettingsStep` (1),
  `SquareEntryStep` (2), or `ReviewStepStub` (3). Same unmount-per-step
  invariant as before (each step fully unmounts the other so it always
  remounts fresh from the latest lifted state on back-navigation) — comment
  carried forward and updated to mention the new step.
- `square-entry-step.tsx` (new, replaces `square-entry-step-stub.tsx`).
  Props: `settings: CardSettings`, `defaultValues: SquareDraft[]`,
  `onComplete: (squares: SquareDraft[]) => void`, `onBack: () => void`.
  - On mount, seeds local `squares` state: builds an array of length
    `gridSize*gridSize - (hasFreeSpace?1:0)`, reusing entries from
    `defaultValues` by index where present (so going back to step 1 and
    forward again without changing grid size preserves everything typed;
    shrinking the grid truncates, growing it pads with fresh defaults),
    filling new/missing entries with `{ label: "", kind: "CHECK", goal: 1
    }`.
  - UI: `CardHeader` title "Fill in your squares 📝", then a `flex
    flex-col gap-4` scrollable list of rows, one per square in position
    order. Each row:
    - Numbered label ("Square 1", "Square 2", ...).
    - `Input` for the label text, required, `maxLength={128}` (matches
      the card-name field).
    - `SegmentedControl` (`Check` / `Counter`) for `kind`.
    - When `kind === "COUNTER"`, an additional numeric `Input`
      (`type="number" min={2}`, default `2`) for `goal`. Hidden entirely
      for CHECK squares (goal is implicitly `1`, not shown/editable).
  - Validation on "Next": every label must be non-empty after `.trim()`.
    First empty row gets an inline error ("Give this square a label") and
    focus; blocks advancing. Not validated per-keystroke (matches step 1).
  - "Back" button returns to step 1, current `squares` lifted to
    `CardBuilder` first so nothing is lost.
- `review-step-stub.tsx` (new). Step 3 placeholder, same spirit as the
  step-2 stub it replaces: echoes `CardSettings` as text, plus a compact
  list of entered squares (`label · kind · goal` for COUNTER, `label ·
  check` for CHECK), and a "Back" button (returns to step 2, squares
  preserved). Includes a note: "Saving is tracked in issue #4." Expected to
  be deleted/replaced wholesale when issue #4 lands.

## Non-goals

- No drag-to-reorder of squares.
- No editable goal for CHECK squares (fixed at 1, hidden from the UI).
- No Firestore writes, no Server Action.
- No random-shuffle preview (issue #3).
- No support for grid sizes other than 3 and 5 (unchanged from issue #1).

## Out of scope follow-ups (already tracked)

- Issue #3: random layout shuffle at creation time.
- Issue #4: persisting card + squares via Server Action, replacing
  `ReviewStepStub` with the real final step.
