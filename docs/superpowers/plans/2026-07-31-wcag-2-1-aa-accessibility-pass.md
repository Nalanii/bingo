# WCAG 2.1 AA Accessibility Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Bingoal (a Next.js 16 / React 19 / Tailwind v4 bingo-card app) up to WCAG 2.1 Level AA across color contrast, focus states, keyboard navigation, labels, and screen-reader behavior, per [GitHub issue #17](https://github.com/nalanii/bingo/issues/17).

**Architecture:** No accessible-component library exists (no Radix/shadcn/Ariakit) — every interactive primitive (`Button`, `Input`, `Switch`, `SegmentedControl`, two hand-rolled dialogs) is custom. Fixes are surgical: new CSS design tokens for the handful of color pairs that fail contrast, a small shared `useDialogA11y` hook for the two dialogs' focus-trap/keyboard behavior, targeted ARIA/label additions, and a couple of small pure-logic extractions so the fixes are unit-testable. A prior codebase audit (full findings below each task) is the source of every specific value in this plan — every hex, ratio, and line number was verified against the actual repo, not estimated.

**Tech Stack:** Next.js 16.2.11 (App Router), React 19.2.4, TypeScript 5, Tailwind CSS v4 (CSS-native tokens in `src/app/globals.css`, no `tailwind.config.js`), Vitest 4 (currently `environment: "node"`, no DOM testing infra), `lucide-react` (already a dependency, currently unused anywhere in `src`).

## Global Constraints

- Target WCAG 2.1 Level AA for every fix in this plan (issue #17's explicit bar).
- `npm run lint && npm run typecheck && npm run build` must pass before any task is considered done (AGENTS.md).
- Mobile and desktop must both keep working — this app is designed mobile-first (AGENTS.md). Don't test only at desktop width.
- Restyle via the design tokens in `src/app/globals.css`, not one-off hex values in components (AGENTS.md) — every new color in this plan is added as a token, not inlined.
- Preserve the existing "fun and funky, bold colors, rounded shapes" visual identity (AGENTS.md) — every color token change in this plan darkens/lightens an existing brand hue in place (same hue, adjusted lightness) rather than introducing an unrelated color.
- Use Conventional Commits for every commit (AGENTS.md): `feat:`, `fix:`, `test:`, `refactor:`, `chore:` as appropriate.
- Don't regress a check that already passes while fixing another (e.g., dark-mode contrast is already compliant everywhere audited — don't touch dark-mode tokens except where a task says to; `SegmentedControl`'s existing arrow-key roving-tabindex navigation already works correctly — don't rewrite it).
- Every new interactive behavior (focus trap, keyboard handling) must be verified by an automated test, not just manual QA — this app currently has zero component-level tests, and dialogs are exactly the kind of thing that silently regresses without one.

---

### Reference: the exact contrast failures this plan fixes

Computed with the standard WCAG relative-luminance formula (verified by script, not by hand):

| Pair | Current ratio | Required | Status |
|---|---|---|---|
| `--primary` bg / white text (light) | 3.14:1 | 4.5:1 (normal text) | **Fail** |
| `--destructive` bg / white text (light) | 4.19:1 | 4.5:1 (normal text) | **Fail** |
| `--border` / `--background` (light) | 1.19:1 | 3:1 (non-text UI) | **Fail** |
| `--border` / `--card` (light) | 1.24:1 | 3:1 (non-text UI) | **Fail** |
| `--border` / `--background` (dark) | 1.39:1 | 3:1 (non-text UI) | **Fail** |
| `--border` / `--card` (dark) | 1.26:1 | 3:1 (non-text UI) | **Fail** |
| `text-primary` (landing wordmark "B"/"G") / `--background` | 2.99:1 | 3:1 (large bold text) | **Fail** |
| `text-success` (landing wordmark "N") / `--background` | 2.07:1 | 3:1 (large bold text) | **Fail** |
| `text-accent` (landing wordmark "O") / `--background` | 1.38:1 | 3:1 (large bold text) | **Fail** |

Dark-mode text-on-background pairs (primary 6.78:1, success 10.20:1, accent 13.67:1) already pass comfortably and are **not** touched by this plan.

---

## Task 1: Color-contrast utility + reference tests

**Files:**
- Create: `src/lib/color-contrast.ts`
- Test: `src/lib/color-contrast.test.ts`

**Interfaces:**
- Produces: `contrastRatio(hexA: string, hexB: string): number` — WCAG relative-luminance contrast ratio between two `#rrggbb` colors, order-independent, returns a value `>= 1`. Used by Task 2 and Task 3's regression tests.

This is the foundation every later contrast-fixing task's regression test builds on — get it right once, verified against published reference pairs, so no later task has to re-derive the math.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/color-contrast.test.ts
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color-contrast";

describe("contrastRatio", () => {
  it("returns 21:1 for pure black on pure white (the maximum possible ratio)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("returns 1:1 for a color against itself", () => {
    expect(contrastRatio("#7c4dff", "#7c4dff")).toBeCloseTo(1, 5);
  });

  it("is order-independent", () => {
    const a = contrastRatio("#ff4d8d", "#ffffff");
    const b = contrastRatio("#ffffff", "#ff4d8d");
    expect(a).toBeCloseTo(b, 10);
  });

  it("matches the published WCAG example: #767676 on white is ~4.54:1 (the classic 'just passes AA' gray)", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
  });

  it("matches this app's known-failing pair: --primary bg vs white text is ~3.14:1", () => {
    expect(contrastRatio("#ff4d8d", "#ffffff")).toBeCloseTo(3.14, 1);
  });

  it("matches this app's known-passing pair: --secondary bg vs white text is ~4.81:1", () => {
    expect(contrastRatio("#7c4dff", "#ffffff")).toBeCloseTo(4.81, 1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/color-contrast.test.ts`
Expected: FAIL — `Cannot find module './color-contrast'` (the module doesn't exist yet).

- [ ] **Step 3: Implement the utility**

```typescript
// src/lib/color-contrast.ts

/**
 * WCAG 2.1 relative-luminance contrast ratio between two `#rrggbb` hex
 * colors. Order-independent; always returns the ratio of the lighter color
 * over the darker one, so the result is always >= 1.
 *
 * Formula: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexToRgb(hexA));
  const luminanceB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function channelLuminance(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/color-contrast.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/color-contrast.ts src/lib/color-contrast.test.ts
git commit -m "test: add WCAG contrast-ratio utility"
```

---

## Task 2: Fix text-on-fill and non-text-UI contrast (`--primary`, `--destructive`, `--control-border`)

**Files:**
- Modify: `src/app/globals.css:7-52` (add/change tokens)
- Modify: `src/components/ui/input.tsx:11`
- Modify: `src/components/ui/button.tsx:17`
- Modify: `src/components/ui/switch.tsx:35`
- Modify: `src/components/completion-history-modal.tsx:161,191,225`
- Test: `src/app/design-tokens.contrast.test.ts` (create)

**Interfaces:**
- Consumes: `contrastRatio` from `src/lib/color-contrast.ts` (Task 1).
- Produces: new CSS custom properties `--control-border` (light `#a57acf`, dark `#7662a7`) and its Tailwind mapping `--color-control-border` → utility classes `border-control-border` / `bg-control-border` / `text-control-border`. Later tasks that touch interactive-control borders should use this token, not `border-border`.

**Background:** `--primary` (`#ff4d8d`) and `--destructive` (`#e5384f`) are used as button fills with white foreground text, and both fail the 4.5:1 normal-text threshold (3.14:1 and 4.19:1). `--border` (`#ece3f5` light / `#352b4d` dark) is used as the visible boundary of `Input`, `Button`'s `outline` variant, and `Switch` — controls whose boundary is the only way to perceive where the control is — and it fails the 3:1 non-text-UI threshold everywhere (1.19–1.39:1). Decorative uses of `--border` (Card wrappers, header/footer dividers, the `SegmentedControl` group wrapper) are **not** touched — SC 1.4.11 only applies to UI-component boundaries, and darkening every decorative divider in the app is a bigger visual change than the compliance gap requires.

All four new hex values below were computed by darkening the original color in HSL space (same hue, same saturation, reduced lightness) until `contrastRatio` cleared the target with margin — verified by running the actual formula, not estimated:

| Token | Old (light) | New (light) | Ratio | Old (dark) | New (dark) | Ratio |
|---|---|---|---|---|---|---|
| `--primary` | `#ff4d8d` | `#e60053` | 4.68:1 vs white | *(unchanged)* | *(unchanged)* | already 6.78:1 |
| `--destructive` | `#e5384f` | `#e2243d` | 4.61:1 vs white | *(unchanged)* | *(unchanged)* | already passes |
| `--control-border` *(new token)* | — | `#a57acf` | 3.19:1 vs bg, 3.34:1 vs card | — | `#7662a7` | 3.52:1 vs bg, 3.21:1 vs card |

- [ ] **Step 1: Write the failing regression test**

```typescript
// src/app/design-tokens.contrast.test.ts
//
// Hardcoded literal hex values — keep these in sync with src/app/globals.css
// by hand. This is the regression guard for every color-contrast fix in the
// WCAG 2.1 AA pass: if a future edit to globals.css breaks a ratio, this
// test catches it.
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/color-contrast";

const LIGHT = {
  background: "#fff9f0",
  card: "#ffffff",
  primary: "#e60053",
  primaryForeground: "#ffffff",
  destructive: "#e2243d",
  destructiveForeground: "#ffffff",
  controlBorder: "#a57acf",
};

const DARK = {
  background: "#171325",
  card: "#211b33",
  controlBorder: "#7662a7",
};

describe("design token contrast (light mode)", () => {
  it("primary bg vs primary-foreground text meets 4.5:1", () => {
    expect(contrastRatio(LIGHT.primary, LIGHT.primaryForeground)).toBeGreaterThanOrEqual(4.5);
  });

  it("destructive bg vs destructive-foreground text meets 4.5:1", () => {
    expect(contrastRatio(LIGHT.destructive, LIGHT.destructiveForeground)).toBeGreaterThanOrEqual(4.5);
  });

  it("control-border meets 3:1 against both background and card", () => {
    expect(contrastRatio(LIGHT.controlBorder, LIGHT.background)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(LIGHT.controlBorder, LIGHT.card)).toBeGreaterThanOrEqual(3.0);
  });
});

describe("design token contrast (dark mode)", () => {
  it("control-border meets 3:1 against both background and card", () => {
    expect(contrastRatio(DARK.controlBorder, DARK.background)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(DARK.controlBorder, DARK.card)).toBeGreaterThanOrEqual(3.0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/design-tokens.contrast.test.ts`
Expected: FAIL — the constants reference the new (not-yet-applied) hex values, but this test only checks arithmetic, so it should actually already PASS at this point since it doesn't read `globals.css`. Confirm instead that it fails if you temporarily set `LIGHT.primary` back to `"#ff4d8d"` locally (it should drop below 4.5), then restore it to `"#e60053"` before continuing. This proves the test is actually exercising the ratio, not vacuously passing.

- [ ] **Step 3: Update `globals.css`**

In `src/app/globals.css`, change the `:root` block (lines 7–29):

```css
:root {
  --background: #fff9f0; /* warm cream */
  --foreground: #211e2e; /* ink */
  --card: #ffffff;
  --card-foreground: #211e2e;
  --muted: #f3ecf9;
  --muted-foreground: #6b6480;
  --border: #ece3f5;
  --control-border: #a57acf; /* darker than --border: meets 3:1 for interactive-control boundaries */
  --ring: #7c4dff;

  --primary: #e60053; /* hot magenta, darkened for 4.5:1 text contrast */
  --primary-foreground: #ffffff;
  --secondary: #7c4dff; /* electric purple */
  --secondary-foreground: #ffffff;
  --accent: #ffd23f; /* sunny yellow */
  --accent-foreground: #211e2e;
  --success: #2ec4b6; /* teal */
  --success-foreground: #06312c;
  --destructive: #e2243d; /* alert red, darkened for 4.5:1 text contrast */
  --destructive-foreground: #ffffff;

  --radius: 1rem;
}
```

And the dark `@media` block (lines 31–52) — add `--control-border` only (dark-mode `--primary`/`--destructive` already pass, leave unchanged):

```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: #171325;
    --foreground: #f4eeff;
    --card: #211b33;
    --card-foreground: #f4eeff;
    --muted: #2a2340;
    --muted-foreground: #b0a6c9;
    --border: #352b4d;
    --control-border: #7662a7; /* lighter than --border: meets 3:1 for interactive-control boundaries */
    --ring: #b28bff;
    --primary: #ff6aa2;
    --primary-foreground: #2a0714;
    --secondary: #9b7bff;
    --secondary-foreground: #150a2e;
    --accent: #ffdd6b;
    --accent-foreground: #211e2e;
    --success: #4fd6c9;
    --success-foreground: #06312c;
    --destructive: #ff5c72;
    --destructive-foreground: #2a0714;
  }
}
```

And the `@theme inline` block (lines 54–80) — add one line after `--color-border`:

```css
  --color-border: var(--border);
  --color-control-border: var(--control-border);
  --color-ring: var(--ring);
```

- [ ] **Step 4: Swap the interactive-control borders to the new token**

In `src/components/ui/input.tsx:11`, change `border-2 border-border` to `border-2 border-control-border`.

In `src/components/ui/button.tsx:17`, change the `outline` variant from:
```typescript
outline:
  "border-2 border-border bg-card text-card-foreground hover:border-secondary",
```
to:
```typescript
outline:
  "border-2 border-control-border bg-card text-card-foreground hover:border-secondary",
```

In `src/components/ui/switch.tsx:35`, change `border-2 border-border` to `border-2 border-control-border`.

In `src/components/completion-history-modal.tsx`:
- Line 161 (close button): change `"border-border bg-card text-card-foreground flex h-6 w-6 ..."` to `"border-control-border bg-card text-card-foreground flex h-6 w-6 ..."`.
- Line 191 (date input): change `"border-border bg-card text-card-foreground w-full ..."` to `"border-control-border bg-card text-card-foreground w-full ..."`.
- Line 225 (save button): change `"border-border bg-card text-card-foreground rounded-[var(--radius-sm)] border px-3 py-1 ..."` to `"border-control-border bg-card text-card-foreground rounded-[var(--radius-sm)] border px-3 py-1 ..."`.

Leave every other `border-border` usage untouched (Card, page dividers, `SegmentedControl` wrapper, dialog panel borders) — those are decorative/grouping, not per-control state indicators.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/app/design-tokens.contrast.test.ts`
Expected: PASS (3/3)

- [ ] **Step 6: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add src/app/globals.css src/components/ui/input.tsx src/components/ui/button.tsx src/components/ui/switch.tsx src/components/completion-history-modal.tsx src/app/design-tokens.contrast.test.ts
git commit -m "fix: darken primary/destructive tokens and add control-border token for AA contrast"
```

---

## Task 3: Fix landing-page wordmark contrast

**Files:**
- Modify: `src/app/globals.css` (add three new tokens)
- Modify: `src/app/page.tsx:29-33`
- Modify: `src/app/design-tokens.contrast.test.ts` (extend, from Task 2)

**Interfaces:**
- Consumes: `contrastRatio` (Task 1).
- Produces: new tokens `--primary-on-surface`, `--success-on-surface`, `--accent-on-surface` (+ `--color-*` theme mappings → Tailwind utilities `text-primary-on-surface`, `text-success-on-surface`, `text-accent-on-surface`), for text sitting directly on `--background`/`--card` where the fill-oriented `--primary`/`--success`/`--accent` tokens read too light.

**Background:** the landing-page "BINGO" wordmark (`src/app/page.tsx:29-33`) colors three of its five letters with `text-primary`, `text-success`, and `text-accent` directly on the cream `--background`. Those tokens are tuned for use as a *fill* with a matching `-foreground` text color (e.g. `bg-accent text-accent-foreground` = 11.27:1) — used directly as foreground text on the page background, `text-success` and especially `text-accent` (sunny yellow) are barely visible (2.07:1 and 1.38:1), and `text-primary` (2.99:1) is a hair under even the large-text 3:1 floor. `text-secondary` (the "I", 4.60:1) already passes and is untouched.

Computed (same hue-preserving-darken method as Task 2):

| Token (new) | Light value | Ratio vs `--background` | Dark value | Ratio vs dark `--background` |
|---|---|---|---|---|
| `--primary-on-surface` | `#e10051` | 4.64:1 | `#ff6aa2` *(= existing dark `--primary`, already passes)* | 6.78:1 |
| `--success-on-surface` | `#1e7e75` | 4.67:1 | `#4fd6c9` *(= existing dark `--success`)* | 10.20:1 |
| `--accent-on-surface` | `#8e6d00` | 4.62:1 | `#ffdd6b` *(= existing dark `--accent`)* | 13.67:1 |

- [ ] **Step 1: Extend the failing regression test**

Add to `src/app/design-tokens.contrast.test.ts` (same file as Task 2), inside the light-mode `describe` block:

```typescript
  it("wordmark on-surface text tokens meet 4.5:1 against background", () => {
    expect(contrastRatio("#e10051", LIGHT.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#1e7e75", LIGHT.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#8e6d00", LIGHT.background)).toBeGreaterThanOrEqual(4.5);
  });
```

- [ ] **Step 2: Run the test to verify it currently passes on the raw hex (sanity check), then proceed**

Run: `npm test -- src/app/design-tokens.contrast.test.ts`
Expected: PASS — this step is a sanity check that the literal values are correct before wiring them into CSS/JSX in the next steps.

- [ ] **Step 3: Add the new tokens to `globals.css`**

In the `:root` block, after `--destructive-foreground`:

```css
  --destructive-foreground: #ffffff;

  --primary-on-surface: #e10051; /* text-safe darker primary, for text directly on background/card */
  --success-on-surface: #1e7e75; /* text-safe darker success */
  --accent-on-surface: #8e6d00; /* text-safe darker accent */

  --radius: 1rem;
```

In the dark `@media` block, after `--destructive-foreground`:

```css
    --destructive-foreground: #2a0714;

    --primary-on-surface: #ff6aa2;
    --success-on-surface: #4fd6c9;
    --accent-on-surface: #ffdd6b;
  }
}
```

In the `@theme inline` block, after `--color-destructive-foreground`:

```css
  --color-destructive-foreground: var(--destructive-foreground);
  --color-primary-on-surface: var(--primary-on-surface);
  --color-success-on-surface: var(--success-on-surface);
  --color-accent-on-surface: var(--accent-on-surface);
```

- [ ] **Step 4: Update the wordmark**

In `src/app/page.tsx`, lines 29–33, change:

```tsx
            <span className="text-primary">B</span>
            <span className="text-secondary">I</span>
            <span className="text-success">N</span>
            <span className="text-primary">G</span>
            <span className="text-accent">O</span>.
```

to:

```tsx
            <span className="text-primary-on-surface">B</span>
            <span className="text-secondary">I</span>
            <span className="text-success-on-surface">N</span>
            <span className="text-primary-on-surface">G</span>
            <span className="text-accent-on-surface">O</span>.
```

- [ ] **Step 5: Run the full test file and verify**

Run: `npm test -- src/app/design-tokens.contrast.test.ts`
Expected: PASS (all tests in the file, light + dark)

- [ ] **Step 6: Visual check and commit**

Run `npm run dev` (or your usual local server) and load `/` — confirm the wordmark is still legible as a cohesive "BINGO" in the app's color family, just darker, at both a mobile width (~375px) and desktop width.

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add src/app/globals.css src/app/page.tsx src/app/design-tokens.contrast.test.ts
git commit -m "fix: add text-safe on-surface color tokens for landing wordmark contrast"
```

---

## Task 4: Stop conveying bingo-square state by color alone

**Files:**
- Modify: `src/components/bingo-grid.tsx:344-359,442-458`

**Interfaces:**
- Consumes: `lucide-react`'s `Check` icon (already an installed dependency, currently unused anywhere in `src`).

**Background:** completed/goal-reached squares are currently distinguished from in-progress/not-started squares by color and border alone (`border-success bg-success` vs `border-success/50 bg-success/50` vs `border-border bg-card`) — SC 1.4.1 (Use of Color). CHECK squares do have a textual backstop via `aria-pressed`/`aria-label`, but there's no *visual* non-color signal for sighted color-deficient users. Separately, the in-progress vs not-started counter states are nearly indistinguishable at a glance (their tint blend is only ~1.5:1 apart) — the numeric count is the real signal, but the visual treatment should still support it, not fight it.

- [ ] **Step 1: Add a checkmark icon for completed squares**

In `src/components/bingo-grid.tsx`, add the import at the top (after the existing imports):

```typescript
import { Check } from "lucide-react";
```

Change the CHECK-square render (lines 442–458) from:

```tsx
  return (
    <div className={sharedClassName}>
      <button
        type="button"
        className="flex w-full flex-1 flex-col items-center justify-center gap-0.5 disabled:cursor-wait disabled:opacity-70"
        aria-pressed={completed}
        aria-label={`${label} — ${completed ? "completed" : "not completed"}, tap to toggle`}
        disabled={pending}
        onClick={() => onToggle(square)}
      >
        {content}
      </button>
      {completed &&
        latestCompletionDate &&
        historyDateButton("Completed:", formatCompletionDate(latestCompletionDate))}
    </div>
  );
```

to:

```tsx
  return (
    <div className={sharedClassName}>
      {completed && (
        <Check
          aria-hidden="true"
          className="text-success-foreground absolute top-1 right-1 h-3.5 w-3.5 sm:h-4 sm:w-4"
        />
      )}
      <button
        type="button"
        className="flex w-full flex-1 flex-col items-center justify-center gap-0.5 disabled:cursor-wait disabled:opacity-70"
        aria-pressed={completed}
        aria-label={`${label} — ${completed ? "completed" : "not completed"}, tap to toggle`}
        disabled={pending}
        onClick={() => onToggle(square)}
      >
        {content}
      </button>
      {completed &&
        latestCompletionDate &&
        historyDateButton("Completed:", formatCompletionDate(latestCompletionDate))}
    </div>
  );
```

(`sharedClassName` already includes `relative`, line 351, so the icon's `absolute` positioning is relative to the square, not the page.)

Do the same for the COUNTER goal-reached state — in the counter render (lines 402–433), add the same icon as the first child of the outer `<div className={sharedClassName}>`, gated on `goalReached` instead of `completed`:

```tsx
  if (isCounter) {
    return (
      <div className={sharedClassName}>
        {goalReached && (
          <Check
            aria-hidden="true"
            className="text-success-foreground absolute top-1 right-1 h-3.5 w-3.5 sm:h-4 sm:w-4"
          />
        )}
        {renderLabel("line-clamp-3", "text-[0.6rem] sm:text-xs")}
        {/* ...unchanged... */}
```

- [ ] **Step 2: Strengthen the in-progress counter's visual treatment**

Change the `isPartial` branch of `sharedClassName` (line 356–357) from:

```typescript
        : isPartial
          ? "border-success/50 bg-success/50 text-card-foreground"
          : "border-border bg-card text-card-foreground",
```

to:

```typescript
        : isPartial
          ? "border-success bg-success/20 text-card-foreground"
          : "border-border bg-card text-card-foreground",
```

This gives a three-tier visual progression that's readable at a glance without relying on subtle opacity differences: empty outline (not started) → solid teal outline with a light tint (in progress) → solid teal fill (complete).

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open a card with both CHECK and COUNTER squares in various states (not started / in progress / complete), and confirm:
- Completed CHECK squares show a checkmark icon in the top-right corner.
- Goal-reached COUNTER squares show the same checkmark.
- In-progress COUNTER squares are visibly outlined in teal (not just a faint tint), distinct from not-started squares.

- [ ] **Step 4: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add src/components/bingo-grid.tsx
git commit -m "fix: stop conveying bingo-square completion state by color alone"
```

---

## Task 5: Add missing focus-visible rings for keyboard users

**Files:**
- Modify: `src/components/ui/segmented-control.tsx:70-77`
- Modify: `src/components/bingo-grid.tsx:388-400,407-427,442-453`
- Modify: `src/components/completion-history-modal.tsx:158-165,189-203,223-230`

**Background:** `Button`, `Input`, and `Switch` all share the same focus-visible treatment (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`, verified 4.60:1 ring-vs-background contrast in both audits). `SegmentedControl`'s radio buttons and every interactive element inside `BingoGrid`/`CompletionHistoryModal` are missing it entirely — they fall back to the browser's native outline (not suppressed anywhere, so not *invisible*, just visually inconsistent with the rest of the app, and on some browser/OS themes a thin default outline against small colorful squares is hard to see).

The exact shared class string to add everywhere in this task:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
```

- [ ] **Step 1: `SegmentedControl` radio buttons**

In `src/components/ui/segmented-control.tsx`, lines 70–77, change:

```typescript
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed",
            )}
```

to:

```typescript
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed",
            )}
```

- [ ] **Step 2: `BingoGrid` interactive elements**

In `src/components/bingo-grid.tsx`:

- `historyDateButton` (line 391) — add the ring classes to the className string: `"flex flex-col text-[0.55rem] leading-tight italic opacity-80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-[0.6rem]"`.
- Decrement button (line 409) — add to className: `"text-sm leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"`.
- Increment button (line 421) — same addition as the decrement button.
- CHECK-square button (line 446) — add to className: `"flex w-full flex-1 flex-col items-center justify-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-70"`.

- [ ] **Step 3: `CompletionHistoryModal` interactive elements**

In `src/components/completion-history-modal.tsx`:

- Close button (line 161) — add to className: `"border-control-border bg-card text-card-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"`.
- Date input (line 191) — add to className: `"border-control-border bg-card text-card-foreground w-full rounded-[var(--radius-sm)] border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"`.
- Save button (line 225) — add to className: `"border-control-border bg-card text-card-foreground rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40"`.

(These three elements already picked up `border-control-border` in Task 2 — this step only adds the ring classes alongside it.)

- [ ] **Step 4: Manual verification**

Run `npm run dev`, tab through the grid-size/square-order segmented controls, a bingo card's squares, and the completion-history modal, using only the keyboard (Tab / Shift+Tab). Confirm every focused element shows a visible purple ring.

- [ ] **Step 5: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add src/components/ui/segmented-control.tsx src/components/bingo-grid.tsx src/components/completion-history-modal.tsx
git commit -m "fix: add visible focus rings to segmented control, bingo grid, and history modal controls"
```

---

## Task 6: Dialog focus-trap hook + test infrastructure

**Files:**
- Create: `src/lib/use-dialog-a11y.ts`
- Create: `src/lib/use-dialog-a11y.test.tsx`
- Create: `vitest.setup.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json` (devDependencies)
- Modify: `src/components/completion-history-modal.tsx:1,39-93,144-155`

**Interfaces:**
- Produces: `useDialogA11y(containerRef: RefObject<HTMLElement | null>, onClose: () => void): void` — a hook that, for the lifetime of the calling component: moves focus to the first focusable element inside `containerRef` on mount, traps Tab/Shift+Tab within it, calls `onClose()` on Escape, and restores focus to whatever was focused before mount when the component unmounts. Used by `CompletionHistoryModal` in this task and by `UncheckConfirmDialog` in Task 7.

**Background:** neither of this app's two dialogs (`CompletionHistoryModal`, and the inline "un-check" `alertdialog` in `bingo-grid.tsx`) traps focus, moves focus in on open, or returns focus on close — a sighted keyboard user can Tab straight out of an open dialog into the page behind it. `CompletionHistoryModal` does at least close on Escape today (a manual `keydown` listener, lines 84–93); the `alertdialog` doesn't even have that. This task builds the shared fix once; Task 7 reuses it. This is also the first component-level test in the repo, so it adds the (currently entirely absent) jsdom + React Testing Library infrastructure.

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D jsdom@^30.0.1 @testing-library/react@^16.3.2 @testing-library/jest-dom@^7.0.0
```

- [ ] **Step 2: Wire up jsdom + jest-dom matchers**

Create `vitest.setup.ts` at the repo root:

```typescript
import "@testing-library/jest-dom/vitest";
```

Update `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

(The global environment stays `"node"` — existing pure-logic tests don't need a DOM. The new dialog test opts into jsdom per-file in the next step.)

- [ ] **Step 3: Write the failing test**

```tsx
// src/lib/use-dialog-a11y.test.tsx
// @vitest-environment jsdom
import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDialogA11y } from "./use-dialog-a11y";

function Harness({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(ref, onClose);
  return (
    <div ref={ref} role="dialog" aria-label="Test dialog" tabIndex={-1}>
      <button type="button">First</button>
      <button type="button">Last</button>
    </div>
  );
}

function TestApp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div>
      <button type="button">Outside trigger</button>
      {open && <Harness onClose={onClose} />}
    </div>
  );
}

describe("useDialogA11y", () => {
  it("moves focus to the first focusable element inside the dialog on mount", () => {
    render(<Harness onClose={vi.fn()} />);
    expect(screen.getByText("First")).toHaveFocus();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps Tab from the last focusable element back to the first", () => {
    render(<Harness onClose={vi.fn()} />);
    screen.getByText("Last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByText("First")).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element to the last", () => {
    render(<Harness onClose={vi.fn()} />);
    expect(screen.getByText("First")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByText("Last")).toHaveFocus();
  });

  it("returns focus to the previously-focused element when the dialog unmounts", () => {
    const { rerender } = render(<TestApp open={false} onClose={vi.fn()} />);
    const trigger = screen.getByText("Outside trigger");
    trigger.focus();
    expect(trigger).toHaveFocus();

    rerender(<TestApp open={true} onClose={vi.fn()} />);
    expect(screen.getByText("First")).toHaveFocus();

    rerender(<TestApp open={false} onClose={vi.fn()} />);
    expect(trigger).toHaveFocus();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -- src/lib/use-dialog-a11y.test.tsx`
Expected: FAIL — `Cannot find module './use-dialog-a11y'`.

- [ ] **Step 5: Implement the hook**

```typescript
// src/lib/use-dialog-a11y.ts
"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Standard dialog keyboard behavior: on mount, moves focus to the first
 * focusable element inside `containerRef` and remembers what was focused
 * before; while mounted, traps Tab/Shift+Tab within the container and calls
 * `onClose` on Escape; on unmount, restores focus to the remembered element.
 */
export function useDialogA11y(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const initialTarget = getFocusable()[0] ?? container;
    initialTarget.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = getFocusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [containerRef, onClose]);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/lib/use-dialog-a11y.test.tsx`
Expected: PASS (5/5)

- [ ] **Step 7: Wire the hook into `CompletionHistoryModal`**

In `src/components/completion-history-modal.tsx`:

Add to the imports (line 1–9 area):
```typescript
import { useEffect, useRef, useState } from "react";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
```
(`useRef` is new; the rest of the import line already exists.)

Remove the manual Escape-key effect (lines 84–93):
```typescript
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
```

Add a ref and call the hook, right after the component's other `useState` declarations (after line 51):
```typescript
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);
```

Attach the ref and `tabIndex={-1}` to the dialog panel (lines 149–155):
```tsx
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Completion history for ${square.label}`}
        tabIndex={-1}
        className="border-border bg-card text-card-foreground mx-4 flex max-h-[80vh] w-full max-w-sm flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4 focus-visible:outline-none"
        onClick={(event) => event.stopPropagation()}
      >
```

- [ ] **Step 8: Manual verification**

Run `npm run dev`, open a square's completion history (the "Completed:"/"Last completed:" link on a square with history). Confirm: focus moves into the dialog on open (to the Close button); Tab cycles only within the dialog; Escape closes it; after closing, focus returns to the link you clicked.

- [ ] **Step 9: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build && npm test`
Expected: all pass.

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts src/lib/use-dialog-a11y.ts src/lib/use-dialog-a11y.test.tsx src/components/completion-history-modal.tsx
git commit -m "feat: add dialog focus-trap hook with test infra, wire into completion history modal"
```

---

## Task 7: Extract and fix the un-check confirmation dialog

**Files:**
- Create: `src/components/uncheck-confirm-dialog.tsx`
- Modify: `src/components/bingo-grid.tsx:1-14,274-312`

**Interfaces:**
- Consumes: `useDialogA11y` from `src/lib/use-dialog-a11y.ts` (Task 6).
- Produces: `UncheckConfirmDialog({ label, onCancel, onConfirm }: { label: string; onCancel: () => void; onConfirm: () => void })` — a standalone component, importable and testable independent of `BingoGrid`.

**Background:** the inline "un-check" `alertdialog` in `bingo-grid.tsx` (lines 274–312) confirms a destructive, irreversible action ("permanently deletes its completion history") but has no Escape handling, no focus trap, and no initial-focus/focus-return management — worse gaps than `CompletionHistoryModal` had, on a dialog where focus management matters more (it's guarding a destructive action). It's inline JSX inside `BingoGrid`'s render, so it can't call a hook directly without breaking React's rules of hooks when the dialog isn't mounted — extracting it into its own component fixes that structurally as well as functionally.

- [ ] **Step 1: Create the extracted component**

```tsx
// src/components/uncheck-confirm-dialog.tsx
"use client";

import { useRef } from "react";
import { useDialogA11y } from "@/lib/use-dialog-a11y";

interface UncheckConfirmDialogProps {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms un-checking a CHECK square, since doing so permanently deletes
 * its only completion record. An `alertdialog` (not a plain `dialog`) since
 * it's interrupting the user about a destructive, irreversible action.
 */
export function UncheckConfirmDialog({ label, onCancel, onConfirm }: UncheckConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onCancel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Undo ${label}?`}
        tabIndex={-1}
        className="border-border bg-card text-card-foreground mx-4 flex w-full max-w-sm flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4 focus-visible:outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm">
          Undo <span className="font-bold">{label}</span>? This permanently deletes its
          completion history.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="border-control-border bg-card text-card-foreground rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="border-destructive bg-destructive text-destructive-foreground rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={onConfirm}
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace the inline dialog in `bingo-grid.tsx`**

Add the import near the top of `src/components/bingo-grid.tsx` (alongside the other component imports, e.g. after the `BingoCelebration` import at line 14):
```typescript
import { UncheckConfirmDialog } from "@/components/uncheck-confirm-dialog";
```

Replace the entire block at lines 274–312:

```tsx
      {squareToUncheck && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSquareToUncheck(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={`Undo ${squareToUncheck.label}?`}
            className="border-border bg-card text-card-foreground mx-4 flex w-full max-w-sm flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm">
              Undo <span className="font-bold">{squareToUncheck.label}</span>? This permanently
              deletes its completion history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="border-border bg-card text-card-foreground rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium"
                onClick={() => setSquareToUncheck(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="border-destructive bg-destructive text-destructive-foreground rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium"
                onClick={() => {
                  const square = squareToUncheck;
                  setSquareToUncheck(null);
                  performToggle(square);
                }}
              >
                Undo
              </button>
            </div>
          </div>
        </div>
      )}
```

with:

```tsx
      {squareToUncheck && (
        <UncheckConfirmDialog
          label={squareToUncheck.label}
          onCancel={() => setSquareToUncheck(null)}
          onConfirm={() => {
            const square = squareToUncheck;
            setSquareToUncheck(null);
            performToggle(square);
          }}
        />
      )}
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, check a CHECK square to complete it, then tap it again to un-check it — the confirm dialog should appear with focus on "Cancel", Tab should cycle only within the dialog, Escape should cancel, and after either Cancel or Undo, focus should return to the square's button.

- [ ] **Step 4: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add src/components/uncheck-confirm-dialog.tsx src/components/bingo-grid.tsx
git commit -m "refactor: extract un-check confirmation dialog with focus trap and Escape support"
```

---

## Task 8: Make the truncated-label tooltip visible on keyboard focus

**Files:**
- Modify: `src/components/bingo-grid.tsx:372-386`

**Background:** square labels are visually clamped (`line-clamp-3`/`line-clamp-4`) with the full text exposed via a tooltip that only appears on `group-hover` (line 381) — a keyboard-only sighted user tabbing to a square with a long, truncated label has no way to see the full text. (Screen-reader users are unaffected since the underlying text node isn't DOM-truncated.)

- [ ] **Step 1: Add a focus-visible variant alongside the hover variant**

In `src/components/bingo-grid.tsx`, `renderLabel` (lines 372–386), change the tooltip span's className (line 381) from:

```tsx
        className="border-border bg-card text-card-foreground pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max max-w-[9rem] -translate-x-1/2 scale-95 rounded-[var(--radius-sm)] border px-2 py-1 text-center text-[0.65rem] leading-snug font-medium opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-hover:delay-[700ms] sm:text-xs"
```

to:

```tsx
        className="border-border bg-card text-card-foreground pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max max-w-[9rem] -translate-x-1/2 scale-95 rounded-[var(--radius-sm)] border px-2 py-1 text-center text-[0.65rem] leading-snug font-medium opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-hover:delay-[700ms] group-focus-within:scale-100 group-focus-within:opacity-100 sm:text-xs"
```

(`group-focus-within` fires as soon as any descendant of the `group` — the square's button — has focus, so it shows immediately on keyboard focus rather than waiting for the hover delay, which only matters for a mouse.)

- [ ] **Step 2: Manual verification**

Run `npm run dev`, find (or temporarily create) a square with a label long enough to be clamped, and Tab to it — confirm the full-label tooltip appears above the square without needing to hover.

- [ ] **Step 3: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add src/components/bingo-grid.tsx
git commit -m "fix: show truncated square label tooltip on keyboard focus, not just hover"
```

---

## Task 9: Row/column context for screen readers + name the completed line

**Files:**
- Create: `src/lib/cards/celebration-text.ts`
- Create: `src/lib/cards/celebration-text.test.ts`
- Modify: `src/components/bingo-grid.tsx:56-111,237-249,317-335,344,409-410,421-422,447-448`
- Modify: `src/components/bingo-celebration.tsx`

**Interfaces:**
- Consumes: `BingoLine`/`BingoLineType` from `src/lib/cards/progress.ts` (existing, unchanged).
- Produces: `describeLine(line: BingoLine): string` and `buildLineSrText(lines: BingoLine[], fallback: string): string` from the new `celebration-text.ts` (pure, unit-testable, no DOM needed). `BingoCelebration` gains an optional `lines?: BingoLine[]` prop.

**Background:** the audit's single biggest structural finding — screen-reader users get no row/column/diagonal positional information anywhere in the grid, and the win celebration's announcement ("Bingo! You completed a line.", already a `role="status"` live region — a genuinely good existing pattern) doesn't say *which* line. Rather than retrofitting `role="grid"`/`row`/`gridcell` (which per the ARIA Authoring Practices obligates a full roving-tabindex arrow-key navigation model the interaction design here doesn't have — adding the container roles without it is a known anti-pattern that can make screen-reader behavior *worse*, not better), this task takes the lower-risk, well-supported route: augment each control's accessible name with its position, and make the existing win announcement name the specific line.

- [ ] **Step 1: Write the failing test for the pure line-naming logic**

```typescript
// src/lib/cards/celebration-text.test.ts
import { describe, expect, it } from "vitest";
import { describeLine, buildLineSrText } from "./celebration-text";

describe("describeLine", () => {
  it("describes a row", () => {
    expect(describeLine({ type: "row", index: 1 })).toBe("row 2");
  });

  it("describes a column", () => {
    expect(describeLine({ type: "column", index: 0 })).toBe("column 1");
  });

  it("describes the main diagonal", () => {
    expect(describeLine({ type: "diagonal", index: 0 })).toBe(
      "the top-left to bottom-right diagonal",
    );
  });

  it("describes the anti-diagonal", () => {
    expect(describeLine({ type: "diagonal", index: 1 })).toBe(
      "the top-right to bottom-left diagonal",
    );
  });
});

describe("buildLineSrText", () => {
  it("uses the provided fallback with no lines", () => {
    expect(buildLineSrText([], "Bingo! You completed a line.")).toBe(
      "Bingo! You completed a line.",
    );
  });

  it("names a single completed line, ignoring the fallback", () => {
    expect(buildLineSrText([{ type: "row", index: 1 }], "fallback")).toBe(
      "Bingo! You completed row 2.",
    );
  });

  it("names every line when multiple complete at once", () => {
    expect(
      buildLineSrText(
        [
          { type: "row", index: 1 },
          { type: "column", index: 0 },
        ],
        "fallback",
      ),
    ).toBe("Bingo! You completed 2 lines: row 2, column 1.");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/cards/celebration-text.test.ts`
Expected: FAIL — `Cannot find module './celebration-text'`.

- [ ] **Step 3: Implement the pure logic**

```typescript
// src/lib/cards/celebration-text.ts
import type { BingoLine } from "./progress";

/** Human-readable description of a single completed bingo line. */
export function describeLine(line: BingoLine): string {
  if (line.type === "diagonal") {
    return line.index === 0
      ? "the top-left to bottom-right diagonal"
      : "the top-right to bottom-left diagonal";
  }
  return `${line.type} ${line.index + 1}`;
}

/**
 * Screen-reader announcement text for the set of lines that just completed.
 * `fallback` is used verbatim when `lines` is empty (e.g. a caller that
 * hasn't wired up line-tracking yet, or an unexpected empty-array case).
 */
export function buildLineSrText(lines: BingoLine[], fallback: string): string {
  if (lines.length === 0) return fallback;
  if (lines.length === 1) return `Bingo! You completed ${describeLine(lines[0])}.`;
  return `Bingo! You completed ${lines.length} lines: ${lines.map(describeLine).join(", ")}.`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/cards/celebration-text.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Track and pass through the newly-completed lines**

In `src/components/bingo-grid.tsx`, add a new state declaration after `previousBlackoutRef` (line 79):
```typescript
  const [newLines, setNewLines] = useState<BingoLine[]>([]);
```
Add the import for the type, alongside the existing `getBingoLines` import (line 6):
```typescript
import { getBingoLines, type BingoLine } from "@/lib/cards/progress";
```

Replace the effect body (lines 81–111) — same logic, but capturing the actual newly-completed `BingoLine[]` instead of only a boolean:

```typescript
  useEffect(() => {
    const doneByPosition = new Map<number, boolean>();
    for (const square of squares) {
      doneByPosition.set(square.position, isSquareDone(square, completedSquareIds, counts));
    }

    const currentLines = getBingoLines(gridSize, doneByPosition);
    const currentLineKeys = new Set(currentLines.map((line) => `${line.type}-${line.index}`));
    const previousLineKeys = previousLineKeysRef.current;
    previousLineKeysRef.current = currentLineKeys;

    const isBlackout = squares.length > 0 && squares.every((square) =>
      isSquareDone(square, completedSquareIds, counts),
    );
    const previousBlackout = previousBlackoutRef.current;
    previousBlackoutRef.current = isBlackout;

    // Seed on mount without celebrating lines/blackout that were already complete on load.
    if (previousLineKeys === null) return;

    const isNewBlackout = previousBlackout !== null && !previousBlackout && isBlackout;
    if (isNewBlackout) {
      setBlackoutTrigger((prev) => prev + 1);
      return;
    }

    const linesJustCompleted = currentLines.filter(
      (line) => !previousLineKeys.has(`${line.type}-${line.index}`),
    );
    if (linesJustCompleted.length > 0) {
      setNewLines(linesJustCompleted);
      setCelebrationTrigger((prev) => prev + 1);
    }
  }, [completedSquareIds, counts, squares, gridSize]);
```

Update the render (line 229) from:
```tsx
      {celebrationTrigger > 0 && <BingoCelebration key={celebrationTrigger} />}
```
to:
```tsx
      {celebrationTrigger > 0 && <BingoCelebration key={celebrationTrigger} lines={newLines} />}
```

- [ ] **Step 6: Wire the line names into `BingoCelebration`**

In `src/components/bingo-celebration.tsx`, add the import:
```typescript
import type { BingoLine } from "@/lib/cards/progress";
import { buildLineSrText } from "@/lib/cards/celebration-text";
```

Add `lines` to the props interface:
```typescript
export interface BingoCelebrationProps {
  variant?: BingoCelebrationVariant;
  lines?: BingoLine[];
}
```

Update the component signature and the announcement paragraph:
```typescript
export function BingoCelebration({ variant = "line", lines }: BingoCelebrationProps) {
  const config = CELEBRATION_CONFIG[variant];
  // ...unchanged state/effect...

  const srText =
    variant === "blackout" ? config.srText : buildLineSrText(lines ?? [], config.srText);

  // ...unchanged confetti/badge JSX...
      <p role="status" className="sr-only">
        {srText}
      </p>
```

- [ ] **Step 7: Add row/column context to per-square accessible names**

In `src/components/bingo-grid.tsx`, add `gridSize` to `BingoSquareCell`'s props (both the type, around line 326–335, and the destructured parameter list, around line 317–325):

```typescript
function BingoSquareCell({
  square,
  gridSize,
  completed,
  count,
  latestCompletionDate,
  pending,
  onToggle,
  onProgressChange,
  onViewHistory,
}: {
  square: Square | undefined;
  gridSize: number;
  completed: boolean;
  count: number;
  latestCompletionDate: string | undefined;
  pending: boolean;
  onToggle: (square: Square) => void;
  onProgressChange: (square: Square, direction: "increment" | "decrement") => void;
  onViewHistory: (square: Square) => void;
}) {
```

Pass it from the call site (inside the `.map` in the main render, around line 237–248):
```tsx
          <BingoSquareCell
            key={square?.id ?? position}
            square={square}
            gridSize={gridSize}
            completed={square ? completedSquareIds.has(square.id) : false}
            count={square ? (counts[square.id] ?? 0) : 0}
            latestCompletionDate={square ? latestCompletionDates[square.id] : undefined}
            pending={square ? pendingSquareIds.has(square.id) : false}
            onToggle={handleToggle}
            onProgressChange={handleProgressChange}
            onViewHistory={setHistorySquare}
          />
```

Compute row/column right after the existing destructure (line 344):
```typescript
  const { isFreeSpace, kind, label, goal } = square;
  const row = Math.floor(square.position / gridSize) + 1;
  const col = (square.position % gridSize) + 1;
```

Update the three existing `aria-label`s to include the position prefix:

Decrement button (line 410):
```tsx
            aria-label={`Row ${row} of ${gridSize}, column ${col} of ${gridSize}: Decrease progress on ${label}`}
```

Increment button (line 422):
```tsx
            aria-label={`Row ${row} of ${gridSize}, column ${col} of ${gridSize}: Increase progress on ${label}`}
```

CHECK button (line 448):
```tsx
        aria-label={`Row ${row} of ${gridSize}, column ${col} of ${gridSize}: ${label} — ${completed ? "completed" : "not completed"}, tap to toggle`}
```

- [ ] **Step 8: Manual verification**

Run `npm run dev`, complete a full row (or column, or diagonal) on a card and confirm the on-screen "Bingo!" badge still appears and — using a screen reader (VoiceOver/NVDA) or by checking the DOM in devtools for the `role="status"` element's text — that the announcement now names the specific line (e.g. "Bingo! You completed row 2."). Tab to a few squares and confirm (via devtools accessibility inspector or a screen reader) that their accessible name now starts with "Row X of N, column Y of N:".

- [ ] **Step 9: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build && npm test`
Expected: all pass.

```bash
git add src/lib/cards/celebration-text.ts src/lib/cards/celebration-text.test.ts src/components/bingo-grid.tsx src/components/bingo-celebration.tsx
git commit -m "feat: announce which bingo line completed and add row/column context to grid controls"
```

---

## Task 10: Label the history date inputs; fix validation-error semantics

**Files:**
- Modify: `src/components/completion-history-modal.tsx:181-213`
- Modify: `src/app/dashboard/cards/_builder/card-settings-step.tsx:66-68`
- Modify: `src/app/dashboard/cards/_builder/square-entry-step.tsx:105-107`
- Modify: `src/app/dashboard/cards/_builder/review-step.tsx:89`
- Modify: `src/app/dashboard/cards/[id]/edit/delete-card-button.tsx:44`

**Background:** the per-entry `<input type="date">` in `CompletionHistoryModal` (line 189–203) has no `aria-label` at all — in a list of several rows, a screen reader announces each as an unlabeled "date" spinbutton with no way to tell them apart. Separately, five inline validation/error messages across the app use `text-primary` (magenta/pink) instead of the `text-destructive` token used everywhere else for errors, and — unlike the `role="alert"` messages elsewhere in the app (`bingo-grid.tsx:252`, `completion-history-modal.tsx:172,205,219`) — none of them are announced to screen readers when they appear.

- [ ] **Step 1: Label each history date input**

In `src/components/completion-history-modal.tsx`, inside the `entries.map` (starting line 183), the `<input type="date">` (lines 189–203) currently has no `aria-label`. Add one built from the entry's position, since individual completion entries don't have their own human name:

```tsx
              {entries.map((entry, index) => {
                const draftValue = draftValues[entry.id] ?? isoToDateInputValue(entry.completedAt);
                const rowError = rowErrors[entry.id];

                return (
                  <li key={entry.id} className="flex flex-col gap-1">
                    <input
                      type="date"
                      aria-label={`Completion date, entry ${index + 1} of ${entries.length}`}
                      className="border-control-border bg-card text-card-foreground w-full rounded-[var(--radius-sm)] border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      value={draftValue}
                      onChange={(event) =>
                        setDraftValues((prev) => ({ ...prev, [entry.id]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                          event.preventDefault();
                          handleSaveAll();
                        }
                      }}
                      disabled={saving}
                    />
                    {rowError && (
                      <p role="alert" className="text-destructive text-xs">
                        {rowError}
                      </p>
                    )}
                  </li>
                );
              })}
```

(Only the added `index` parameter to `.map` and the new `aria-label` line are functional changes — the `className` shown already reflects Tasks 2 and 5's edits landing first in the sequence.)

- [ ] **Step 2: Fix the card-settings-step name-required error**

In `src/app/dashboard/cards/_builder/card-settings-step.tsx`, lines 66–68, change:

```tsx
          {nameError ? (
            <p className="text-sm text-primary">{nameError}</p>
          ) : null}
```

to:

```tsx
          {nameError ? (
            <p role="alert" className="text-destructive text-sm">
              {nameError}
            </p>
          ) : null}
```

- [ ] **Step 3: Fix the square-entry-step label-required error**

In `src/app/dashboard/cards/_builder/square-entry-step.tsx`, line 105–107, change:

```tsx
            {errorIndex === index ? (
              <p className="text-sm text-primary">Give this square a label</p>
            ) : null}
```

to:

```tsx
            {errorIndex === index ? (
              <p role="alert" className="text-destructive text-sm">
                Give this square a label
              </p>
            ) : null}
```

- [ ] **Step 4: Fix the review-step save error**

In `src/app/dashboard/cards/_builder/review-step.tsx`, line 89, change:

```tsx
        {error ? <p className="text-sm text-primary">{error}</p> : null}
```

to:

```tsx
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
```

- [ ] **Step 5: Fix the delete-card-button error**

In `src/app/dashboard/cards/[id]/edit/delete-card-button.tsx`, line 44, change:

```tsx
      {error ? <p className="text-sm text-primary">{error}</p> : null}
```

to:

```tsx
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
```

- [ ] **Step 6: Manual verification**

Run `npm run dev`. In the card builder: submit the settings step with an empty name, and the square-entry step with an empty label — confirm the error text is now red (`text-destructive`), not pink. Open a completion-history modal with 2+ entries and confirm (via devtools accessibility inspector) each date input has a distinct accessible name.

- [ ] **Step 7: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add src/components/completion-history-modal.tsx src/app/dashboard/cards/_builder/card-settings-step.tsx src/app/dashboard/cards/_builder/square-entry-step.tsx src/app/dashboard/cards/_builder/review-step.tsx "src/app/dashboard/cards/[id]/edit/delete-card-button.tsx"
git commit -m "fix: label completion-history date inputs and announce validation errors correctly"
```

---

## Task 11: Fix heading hierarchy on the card-builder pages

**Files:**
- Modify: `src/app/dashboard/cards/new/page.tsx:14-21`
- Modify: `src/app/dashboard/cards/[id]/edit/page.tsx:42-55`

**Background:** `CardTitle` always renders an `<h3>` (`src/components/ui/card.tsx:31`) — correct where it's nested under a page-level `<h1>`/`<h2>` (e.g. the dashboard card list has `<h1>Your cards</h1>` at `dashboard/page.tsx:30`), but the new-card and edit-card pages have **no heading above it at all** — the builder's `CardTitle` (e.g. "Build a new card 🎲") is the only heading on the page, and it renders as `<h3>`, skipping h1 and h2 (SC 1.3.1 / heading-order best practice). The play page already does this correctly (`<h1>{card.name}</h1>` at `play/page.tsx:49`) — these two pages are the only gaps.

- [ ] **Step 1: Add a visually-hidden `h1` to the new-card page**

In `src/app/dashboard/cards/new/page.tsx`, change:

```tsx
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        ← Back to your cards
      </Link>
      <CardBuilder mode="create" onSave={saveCard} />
    </div>
  );
```

to:

```tsx
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="sr-only">Build a new card</h1>
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        ← Back to your cards
      </Link>
      <CardBuilder mode="create" onSave={saveCard} />
    </div>
  );
```

(Visually hidden, not a visible duplicate, since the builder's own `CardTitle` already shows "Build a new card 🎲" on screen — the page just needs *some* `h1` in the document outline above it.)

- [ ] **Step 2: Add a visually-hidden `h1` to the edit-card page**

In `src/app/dashboard/cards/[id]/edit/page.tsx`, change:

```tsx
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        ← Back to your cards
      </Link>
      <CardBuilder
        mode="edit"
        initialSettings={initialSettings}
        initialSquares={initialSquares}
        onSave={updateCard.bind(null, card.id)}
      />
      <DeleteCardButton onDelete={deleteCard.bind(null, card.id)} />
    </div>
  );
```

to:

```tsx
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="sr-only">Edit {card.name}</h1>
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        ← Back to your cards
      </Link>
      <CardBuilder
        mode="edit"
        initialSettings={initialSettings}
        initialSquares={initialSquares}
        onSave={updateCard.bind(null, card.id)}
      />
      <DeleteCardButton onDelete={deleteCard.bind(null, card.id)} />
    </div>
  );
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, load `/dashboard/cards/new` and `/dashboard/cards/[id]/edit`, and check via devtools' accessibility tree (or browser devtools' "headings" landmark list) that each page now has exactly one `h1` and the visible layout is unchanged.

- [ ] **Step 4: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add src/app/dashboard/cards/new/page.tsx "src/app/dashboard/cards/[id]/edit/page.tsx"
git commit -m "fix: add page-level h1 to card builder pages to fix heading hierarchy"
```

---

## Task 12: Hide decorative emoji from screen readers

**Files:**
- Modify: `src/app/page.tsx:24-26`
- Modify: `src/app/dashboard/page.tsx:39`
- Modify: `src/components/mini-bingo-preview.tsx:16`
- Modify: `src/app/dashboard/cards/_builder/card-settings-step.tsx:49`
- Modify: `src/app/dashboard/cards/_builder/square-entry-step.tsx:84`
- Modify: `src/app/dashboard/cards/_builder/review-step.tsx:66-68`

**Background:** several decorative emoji are embedded directly in text nodes without `aria-hidden`, so screen readers speak them inline (e.g. "party popper goal and event bingo made fun", "game die", "Build a new card, game die"). The one place this is already done correctly is the ⭐ free-space glyph in `bingo-grid.tsx:364` (`aria-hidden="true"` with a separate "Free" text label doing the accessible naming) — this task brings the rest of the app in line with that existing pattern.

- [ ] **Step 1: Landing page badge emoji**

In `src/app/page.tsx`, lines 24–26, change:

```tsx
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-card px-4 py-1.5 text-sm font-bold">
            🎉 goal &amp; event bingo, made fun
          </span>
```

to:

```tsx
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-card px-4 py-1.5 text-sm font-bold">
            <span aria-hidden="true">🎉</span> goal &amp; event bingo, made fun
          </span>
```

- [ ] **Step 2: Dashboard empty-state emoji**

In `src/app/dashboard/page.tsx`, line 39, change:

```tsx
            <span className="text-5xl">🎲</span>
```

to:

```tsx
            <span aria-hidden="true" className="text-5xl">🎲</span>
```

- [ ] **Step 3: Decorative mini bingo preview**

In `src/components/mini-bingo-preview.tsx`, line 16, the outer decorative preview `<div>` — add `aria-hidden="true"` so the whole example card (including its per-cell "done"/"not done" color-only states, which are purely illustrative) is skipped by screen readers rather than read as if it were real, interactive content:

```tsx
    <div
      aria-hidden="true"
      className="w-full max-w-sm rotate-2 rounded-[var(--radius-lg)] border-2 border-border bg-card p-4 shadow-[0_10px_0_0_rgba(0,0,0,0.08)]"
    >
```

- [ ] **Step 4: Card-builder step heading emoji**

In `src/app/dashboard/cards/_builder/card-settings-step.tsx`, line 49, change:

```tsx
        <CardTitle>{locked ? "Edit card ✏️" : "Build a new card 🎲"}</CardTitle>
```

to:

```tsx
        <CardTitle>
          {locked ? (
            <>
              Edit card <span aria-hidden="true">✏️</span>
            </>
          ) : (
            <>
              Build a new card <span aria-hidden="true">🎲</span>
            </>
          )}
        </CardTitle>
```

In `src/app/dashboard/cards/_builder/square-entry-step.tsx`, line 84, change:

```tsx
        <CardTitle>Fill in your squares 📝</CardTitle>
```

to:

```tsx
        <CardTitle>
          Fill in your squares <span aria-hidden="true">📝</span>
        </CardTitle>
```

In `src/app/dashboard/cards/_builder/review-step.tsx`, lines 66–68, change:

```tsx
        <CardTitle>
          {mode === "edit" ? "Review your changes 🎉" : "Review your card 🎉"}
        </CardTitle>
```

to:

```tsx
        <CardTitle>
          {mode === "edit" ? "Review your changes" : "Review your card"}{" "}
          <span aria-hidden="true">🎉</span>
        </CardTitle>
```

- [ ] **Step 5: Manual verification**

Run `npm run dev` and spot-check via devtools' accessibility tree that the accessible name of each changed heading/badge no longer includes the emoji's spoken description (e.g. "Build a new card" not "Build a new card, game die"), while the emoji is still visually present.

- [ ] **Step 6: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add src/app/page.tsx src/app/dashboard/page.tsx src/components/mini-bingo-preview.tsx src/app/dashboard/cards/_builder/card-settings-step.tsx src/app/dashboard/cards/_builder/square-entry-step.tsx src/app/dashboard/cards/_builder/review-step.tsx
git commit -m "fix: hide decorative emoji from screen readers"
```

---

## Task 13: Skip link, navigation landmark, and loading live region

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx:11`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/components/completion-history-modal.tsx:169`

**Background:** there is no "skip to main content" link anywhere in the app, despite the dashboard header being `sticky` and present on every authenticated page (SC 2.4.1). There's also no `<nav>` landmark anywhere — the dashboard header's brand link and the various "← Back to your cards" links are bare `<Link>`s outside any navigational landmark. Finally, `CompletionHistoryModal`'s "Loading…" text (line 169) is a plain, non-live paragraph, so a screen-reader user isn't told when loading starts or resolves.

- [ ] **Step 1: Add the skip link**

In `src/app/layout.tsx`, change:

```tsx
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
```

to:

```tsx
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="bg-primary text-primary-foreground sr-only rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
```

- [ ] **Step 2: Give both `<main>` elements the matching id**

In `src/app/page.tsx`, line 11, change:
```tsx
    <main className="relative flex flex-1 flex-col items-center overflow-hidden">
```
to:
```tsx
    <main id="main-content" className="relative flex flex-1 flex-col items-center overflow-hidden">
```

In `src/app/dashboard/layout.tsx`, line 30, change:
```tsx
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
```
to:
```tsx
      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
```

- [ ] **Step 3: Wrap the dashboard header's navigational links in a `<nav>` landmark**

In `src/app/dashboard/layout.tsx`, change:

```tsx
      <header className="sticky top-0 z-20 border-b-2 border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/dashboard"
            className="shrink-0 font-display text-xl font-bold"
          >
            Bingoal
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:inline">
              {user?.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
```

to:

```tsx
      <header className="sticky top-0 z-20 border-b-2 border-border bg-background/80 backdrop-blur">
        <nav
          aria-label="Main"
          className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3"
        >
          <Link
            href="/dashboard"
            className="shrink-0 font-display text-xl font-bold"
          >
            Bingoal
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:inline">
              {user?.email}
            </span>
            <SignOutButton />
          </div>
        </nav>
      </header>
```

- [ ] **Step 4: Make the completion-history loading state a live region**

In `src/components/completion-history-modal.tsx`, line 169, change:

```tsx
          {loading && <p className="text-sm">Loading…</p>}
```

to:

```tsx
          {loading && (
            <p role="status" className="text-sm">
              Loading…
            </p>
          )}
```

- [ ] **Step 5: Manual verification**

Run `npm run dev`. Load `/` and press Tab once — confirm a "Skip to main content" pill appears at the top-left and activating it moves focus/scrolls to the main content. Repeat on `/dashboard`. Confirm the dashboard header still looks and behaves identically (the `<nav>` wrapper is layout-transparent — it just replaces the plain `<div>` that held the same flex classes).

- [ ] **Step 6: Full verification and commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/dashboard/layout.tsx src/components/completion-history-modal.tsx
git commit -m "fix: add skip link, nav landmark, and loading live region"
```

---

## Self-Review Notes

**Spec coverage against issue #17's five named areas:**
- *Color contrast* — Tasks 1, 2, 3 (primary/destructive/control-border/wordmark tokens, all verified by automated test against the actual WCAG formula).
- *Focus states* — Task 5 (missing focus-visible rings) and Tasks 6–7 (focus trap/initial-focus/focus-return for both dialogs).
- *Keyboard navigation* — Tasks 6–8 (dialog Tab-trapping and Escape, keyboard-visible tooltip). `SegmentedControl`'s existing arrow-key roving-tabindex navigation was already correct and is untouched.
- *Labels* — Tasks 4 (non-color state), 10 (date-input labels, error announcements), 11 (heading hierarchy), 12 (decorative emoji).
- *Screen-reader behavior* — Tasks 4, 9 (row/column context + named line-completion announcement), 10, 12, 13 (skip link, nav landmark, loading live region).

**Explicitly out of scope, and why:** a full `role="grid"`/`row`/`gridcell` re-architecture of `BingoGrid` was considered and rejected (Task 9's background section) — it would obligate a roving-tabindex arrow-key navigation model this app's interaction design doesn't have, and adding the container roles without it is a known anti-pattern that can make screen-reader behavior worse. Tightening `eslint-plugin-jsx-a11y` coverage (currently only 6 of the plugin's rules are enabled, all at `warn`) was also considered and left out — it's a CI/tooling improvement, not a fix to a specific WCAG failure, and enabling more rules risks surfacing warnings across unrelated code outside this issue's scope.
