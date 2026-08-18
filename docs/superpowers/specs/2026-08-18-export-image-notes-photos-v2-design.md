# Export image notes/photos v2: show every completion, not just the latest

> Revises [docs/superpowers/specs/2026-08-18-export-image-notes-photos-design.md](2026-08-18-export-image-notes-photos-design.md)
> for [GitHub issue #64](https://github.com/Nalanii/bingo/issues/64).

## Why this revision

The first implementation (already built, committed locally, not yet pushed —
`src/lib/cards/export-footnotes.ts`, and the corresponding changes to
`src/app/dashboard/cards/[id]/export-image/image/route.tsx` and
`src/components/export-image-viewer.tsx`) only surfaced a note/photo when it
was on a square's **latest** completion. Live testing found this to be the
wrong behavior in practice: a COUNTER square completed 7 times had a note on
completion #6, but completion #7 (the actual latest) had nothing — so the
export showed no footnote at all for that square, even though a note
genuinely existed in its history. The user wants **every** note/photo-bearing
completion to show, not just the most recent one.

## What changes vs. the original design

The original design's board-marker mechanics, canvas-growth mechanics, and
truncation approach all carry over unchanged. What changes is the
**candidate-selection granularity** (per-square-history instead of
per-latest-completion) and the **footnote section's internal layout** (each
square becomes a labeled block containing one dated sub-row per qualifying
completion, instead of a single flat row).

## Data flow

Group the card's completions by `squareId`. For each square, in board
reading order, filter its completions down to the ones with a `note` and/or
a `photoPath`, sorted **oldest first** (matching the ordering the
completion-history modal already uses). A square with at least one
qualifying completion becomes a **block candidate**: `{ square, completions
}`.

Photo signed-URL resolution now happens per **completion**, not per square —
a square can have several photos to resolve. Every `photoPath`-bearing
completion across every candidate is resolved in parallel (`Promise.all`),
each wrapped in its own try/catch, exactly as before. A completion whose
photo URL fails to resolve, and which also has no note, is dropped from its
block's entry list; if every entry in a block is dropped this way, the whole
block — and its board badge — disappears, so there's never an empty block or
an orphaned badge.

The board's existing "Completed:"/"Last completed:" date caption is
**unaffected** — it continues to reflect the true latest completion for the
square regardless of notes, exactly as it does today.

## Board marker

Unchanged from the original design: one small numbered badge per square (not
per completion), in the square's corner. A square now qualifies for a badge
if **any** of its completions has a note/photo, not just the latest one.

## Footnote section

Each block renders as:

- A **header row**: the numbered badge + the square's label (single-line
  truncated, same as the original board-marker label styling).
- One **sub-row per qualifying completion**, oldest first: the completion's
  date (formatted the same way as the board's existing date captions, e.g.
  "July 6, 2026"), its note text if present (truncated the same way as the
  original design — fixed character budget, fixed 2-line-clamp height), and
  its photo thumbnail if present.

Row heights remain fixed JS constants per row *type* (header row; sub-row
with note; sub-row without note) — never derived from satori measuring
rendered text, same rationale as the rest of this file. The total footnote
section height is the sum of every block's header height plus its sub-rows'
heights plus the gaps between them, computed the same deterministic way as
before.

## Canvas sizing

Unchanged: board sizing math stays fixed against the original 1080 budget.
Total image height grows by the footnote section's computed height, which is
exactly 0 when no square has anything to report — a card with no notes/
photos on any completion renders byte-identical to before this whole
feature.

## Error handling

Unchanged: per-photo try/catch, `console.error` on failure, never throws.

## Testing

- Unit tests for the revised pure logic (`src/lib/cards/export-footnotes.ts`
  — grouping by square, sorting oldest-first, dropping empty entries/blocks,
  height math for multi-entry blocks) replace the original design's tests
  for the old single-entry-per-square logic.
- Manual verification (per the original design and the GitHub issue's own
  "To verify" section): a COUNTER square with notes on multiple (not just
  the latest) completions should show a block listing all of them.

## Out of scope

Same as the original design: no cap on footnote entries or blocks; no
change to the interactive play view.
