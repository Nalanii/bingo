#!/usr/bin/env bash
#
# Bootstraps the Bingoal GitHub project: labels, milestones, and the full
# backlog as issues. Run once, from the repo root, after the repo is pushed.
#
# Requires the GitHub CLI (https://cli.github.com) authenticated for this repo:
#   gh auth login
#
# Usage:
#   ./scripts/bootstrap-github.sh
#
set -euo pipefail

echo "Creating labels…"
create_label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null; }
create_label "feature"     "0e8a16" "A new capability"
create_label "enhancement" "a2eeef" "Improvement to something existing"
create_label "chore"       "fef2c0" "Tooling, deps, config, infra"
create_label "a11y"        "5319e7" "Accessibility"
create_label "design"      "ff69b4" "Visual / UX design"
create_label "future"      "c5def5" "Post-MVP roadmap"
create_label "bug"         "d73a4a" "Something isn't working"

echo "Creating milestones…"
create_milestone() {
  gh api -X POST "repos/{owner}/{repo}/milestones" -f title="$1" -f description="$2" >/dev/null 2>&1 || true
}
create_milestone "M1: Card builder"        "Create, edit, and delete bingo cards."
create_milestone "M2: Play & track"        "Complete squares, count up, and log progress."
create_milestone "M3: Bingo & celebration" "Detect and celebrate lines and blackouts."
create_milestone "M4: Polish & quality"    "Responsive, accessible, tested, production-ready."
create_milestone "Future goals"            "Roadmap beyond the MVP."

issue() { # issue "<title>" "<milestone>" "<labels>" "<body>"
  gh issue create --title "$1" --milestone "$2" --label "$3" --body "$4" >/dev/null
  echo "  + $1"
}

echo "Creating issues…"

# --- M1: Card builder ---------------------------------------------------------
issue "Card settings step (name, size, free space, order)" "M1: Card builder" "feature" \
"First step of the card builder. Capture card name, grid size (3x3 or 5x5), a free-space toggle, and layout order (random or set).

Done when:
- [ ] User can set all four fields
- [ ] Validation and sensible defaults
- [ ] Values flow into the square-entry step"

issue "Square entry UI (labels, type, counter goal)" "M1: Card builder" "feature" \
"Let users fill each square: a text label, a type (check = one and done, counter = reach a target), and a counter goal for counter squares.

Done when:
- [ ] Add/edit labels for the right number of squares
- [ ] Choose type per square
- [ ] Set a goal for counter squares"

issue "Random layout: shuffle and persist positions at creation" "M1: Card builder" "feature" \
"For RANDOM cards, shuffle squares into a fixed layout once at creation and persist each square's position so the card is stable on every visit."

issue "Persist card + squares via Server Action with validation" "M1: Card builder" "feature" \
"Save a new card and its squares in one Server Action. Validate the label count matches the grid size and authorize against the current user."

issue "Free-space handling" "M1: Card builder" "feature" \
"When enabled, reserve the center cell as a free space that counts as pre-complete for BINGO detection."

issue "Edit a card and its squares after creation" "M1: Card builder" "feature" \
"Cards are fully editable anytime: label text, square type, counter goals, and card settings, even after progress exists."

issue "Delete a card (with confirmation)" "M1: Card builder" "feature" \
"Allow deleting a card behind a confirmation step. Cascades to squares and completions."

# --- M2: Play & track ---------------------------------------------------------
issue "Responsive card play view" "M2: Play & track" "feature" \
"Render the card grid for play, mobile-first, scaling cleanly to desktop."

issue "Check squares: toggle complete and log completion" "M2: Play & track" "feature" \
"Tap a check square to complete/uncomplete it, writing/removing a timestamped Completion."

issue "Counter squares: increment/decrement with progress and logging" "M2: Play & track" "feature" \
"Counter squares show progress toward the goal; each increment logs a Completion, each decrement removes the latest."

issue "Completion history with editable dates" "M2: Play & track" "feature" \
"View a square's completion log and edit each entry's date (defaults to when it was checked)."

issue "Dashboard card list with progress summary" "M2: Play & track" "enhancement" \
"Show each card with a quick progress summary and a link into play."

# --- M3: Bingo & celebration --------------------------------------------------
issue "getBingoLines() detection helper + unit tests" "M3: Bingo & celebration" "feature" \
"Pure helper that, given a card, returns completed rows, columns, and diagonals. Unit tested."

issue "Celebrate a new BINGO line" "M3: Bingo & celebration" "feature" \
"When a line completes, fire a celebration (confetti/animation). Foundation for the broader animation goal."

issue "Celebrate a full-card blackout" "M3: Bingo & celebration" "feature" \
"Special celebration when every square is complete."

# --- M4: Polish & quality -----------------------------------------------------
issue "Responsive QA pass" "M4: Polish & quality" "design" \
"Audit every screen across mobile and desktop breakpoints; fix layout issues."

issue "Accessibility pass (WCAG 2.1 AA)" "M4: Polish & quality" "a11y" \
"Color contrast, focus states, keyboard navigation, labels, and screen-reader behavior."

issue "Loading, empty, and error states" "M4: Polish & quality" "enhancement" \
"Cover async views with proper loading, empty, and error UI."

issue "Supabase Row Level Security policies" "M4: Polish & quality" "chore" \
"Add RLS policies as defense-in-depth so users can only access their own rows."

issue "Testing setup (Vitest + Playwright) in CI" "M4: Polish & quality" "chore" \
"Add unit (Vitest) and e2e (Playwright) testing and run them in CI."

issue "SEO / Open Graph metadata + app icons" "M4: Polish & quality" "chore" \
"Add OG/Twitter metadata and a full set of app icons."

issue "Global error boundary + custom not-found page" "M4: Polish & quality" "enhancement" \
"Friendly error and 404 pages that match the funky style."

# --- Future goals -------------------------------------------------------------
issue "Photos attached to completions" "Future goals" "future" \
"Let users attach a photo to a completion (Supabase Storage)."

issue "Card time frames" "Future goals" "future" \
"Optionally scope a card to a time frame (e.g. 'for 2026 only')."

issue "View-only card sharing via code" "Future goals" "future" \
"Share a read-only version of a card with friends via a code, and browse everyone's cards."

issue "Expand grid sizes beyond 3x3 and 5x5" "Future goals" "future" \
"Support additional grid sizes."

issue "Delightful animations everywhere" "Future goals" "future" \
"Micro-interactions and transitions throughout the app."

echo "Done. View them: gh issue list"
