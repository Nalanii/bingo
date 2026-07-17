# Card settings step — design

Tracks [GitHub issue #1](https://github.com/Nalanii/bingo/issues/1).

## Goal

Build the first step of the card builder: a form capturing the four
card-level settings (name, grid size, free-space toggle, layout order), with
validation and sensible defaults, and demonstrate that the captured values
flow forward into the next wizard step.

Square entry itself (issue #2) and persistence via Server Action (issue #4)
are out of scope. This is UI + client state only.

## Non-goals

- No Firestore writes. No Server Action.
- No real square-entry UI — a stub step 2 is enough to prove handoff.
- No support for grid sizes other than 3 and 5 (see issue #26 for future
  expansion).

## New UI primitives (`src/components/ui/`)

Following the existing `button.tsx` / `card.tsx` conventions (`cva` +
Tailwind v4 semantic tokens from `globals.css`, no raw hex):

- **`Input`** — text input styled to match the card/button rounded aesthetic,
  with a visible focus ring (`focus-visible:ring-ring`).
- **`SegmentedControl`** — a `role="radiogroup"` pill toggle for a small set
  of mutually exclusive string options, keyboard-navigable (arrow keys move
  selection, matching native radio-group behavior). Used for both grid size
  and layout order.
- **`Switch`** — boolean toggle for free space, native `<button
  role="switch">` pattern, `aria-checked` reflects state.

All three are presentational/controlled (value + onChange props), no
internal form logic, so they're reusable in later steps (square entry, edit
flow in issue #6).

## Wizard state (`src/app/dashboard/cards/new/`)

- `page.tsx` — stays a Server Component. Calls `getUser()`, redirects to
  `/` if signed out (matching the pattern in `dashboard/layout.tsx`), then
  renders `<CardBuilder />`.
- `CardBuilder.tsx` — new `"use client"` component. Owns:

  ```ts
  type CardSettings = {
    name: string;
    gridSize: 3 | 5;
    hasFreeSpace: boolean;
    layout: "RANDOM" | "SET";
  };

  type WizardState =
    | { step: 1 }
    | { step: 2; settings: CardSettings };
  ```

  Plain `useState`, no external state library — a two-step wizard doesn't
  need one.

- `CardSettingsStep.tsx` — step 1, the form:
  - **Name**: `Input`, required. Trimmed before validation. Empty (after
    trim) shows an inline error ("Give your card a name") and blocks
    advancing. Max length 128, enforced via `maxLength` attribute (no error
    state needed since it can't be exceeded through the input).
  - **Grid size**: `SegmentedControl`, options `3×3` / `5×5`, values `3` /
    `5`. Default `5`.
  - **Free space**: `Switch`, label "Free space in the center". Default on.
    Always enabled — both 3×3 and 5×5 have a real center square, no
    size-based restriction.
  - **Order**: `SegmentedControl`, options `Random` / `Set`, values
    `RANDOM` / `SET`. Default `RANDOM`.
  - "Next" button (`variant="primary"`): on click, validates name; if valid,
    calls `onComplete(settings)` which advances `CardBuilder`'s state to
    step 2.
- `SquareEntryStepStub.tsx` — step 2 placeholder. Renders the received
  `CardSettings` as plain text (e.g. "Card: {name} · {gridSize}×{gridSize} ·
  free space {on/off} · {layout} order") and a "Back" button that returns to
  step 1 (settings preserved, since they still live in `CardBuilder`'s
  state). This file is expected to be deleted/replaced wholesale when issue
  #2 implements real square entry — it exists only to satisfy "values flow
  into the square-entry step" for this issue.

## Validation

Client-side only, on the "Next" click (not on every keystroke, to avoid
premature error noise). No Server Action — nothing is persisted yet.

## Out of scope follow-ups (already tracked)

- Issue #2: real square-entry UI replacing the stub.
- Issue #3: random layout shuffle at creation time.
- Issue #4: persisting card + squares via Server Action.
- Issue #5: free-space handling in play.
