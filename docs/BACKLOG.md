# Backlog

The plan for Bingoal, grouped by milestone. This mirrors the GitHub Issues —
each item below maps to one issue. Checked items are done.

**Labels:** `feature` · `enhancement` · `chore` · `a11y` · `design` · `future`

---

## ✅ Milestone 0 — Foundation

- [x] Scaffold Next.js 16 (App Router) + TypeScript + Tailwind v4
- [x] shadcn/ui-style component base + funky design tokens
- [x] Firebase Google-only auth (sign in/out, session cookie, middleware)
- [x] Firestore data model: profiles, cards (embedded squares), completions
- [x] Funky landing page + protected dashboard stub
- [x] README, AGENTS/CLAUDE guides, CONTRIBUTING, CI

## Milestone 1 — Card builder `feature`

- [ ] Card settings step: name, size (3×3 / 5×5), free-space toggle, order (random / set)
- [ ] Square entry UI: add labels, choose type (check / counter), set counter goal
- [ ] Random layout: shuffle squares into fixed `position`s once, at creation
- [ ] Persist card + squares via a Server Action, with validation (label count matches grid)
- [ ] Free-space handling: reserve the center cell and mark it pre-complete
- [ ] Edit a card and its squares after creation (fully editable)
- [ ] Delete a card (with confirmation)

## Milestone 2 — Play & track `feature`

- [ ] Responsive card play view: render the grid, mobile-first
- [ ] Check squares: toggle complete/incomplete and log the completion
- [ ] Counter squares: increment/decrement, show progress, log each step
- [ ] Completion history: view entries and edit `completedAt`
- [ ] Dashboard card list: show progress summary and open a card

## Milestone 3 — Bingo & celebration `feature`

- [ ] `getBingoLines()` helper: detect complete rows, columns, diagonals (+ unit tests)
- [ ] Celebrate a new BINGO line (confetti / animation)
- [ ] Celebrate a full-card blackout

## Milestone 4 — Polish & quality `enhancement`

- [ ] Responsive QA pass across mobile and desktop breakpoints `design`
- [ ] Accessibility pass — WCAG 2.1 AA: contrast, focus, keyboard nav, labels `a11y`
- [ ] Loading, empty, and error states for all async views
- [x] Firestore security rules denying direct client access (defense-in-depth) `chore`
- [ ] Testing setup: Vitest (unit) + Playwright (e2e), wired into CI `chore`
- [ ] SEO / Open Graph metadata + app icons `chore`
- [ ] Global error boundary + custom not-found page

## 🔮 Future goals `future`

- [ ] Photos attached to completions (Firebase Storage)
- [ ] Card time frames (e.g. "this card is for 2026 only")
- [ ] View-only card sharing with friends via a code + browse others' cards
- [ ] Expand grid sizes beyond 3×3 and 5×5
- [ ] Delightful animations everywhere — micro-interactions and transitions
