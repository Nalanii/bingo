# Export image: notes and photos — design

> Closes [GitHub issue #64](https://github.com/Nalanii/bingo/issues/64).

## Goal

The exported card image (`/dashboard/cards/[id]/export-image`, route handler
at [route.tsx](../../../src/app/dashboard/cards/[id]/export-image/image/route.tsx))
currently renders each square's completion date but not its note or photo.
This adds both, via a numbered-footnote system: a small badge on the board
points to an entry in a "Notes" section below the board, so the exported
image stays a richer keepsake without breaking the tight per-cell layout
math the board already depends on.

Issue #64 originally phased this as "notes now, photos later (blocked by
#23)". #23 (photo-per-completion) has since shipped, so this design covers
both in one pass.

## Data flow

The route currently builds `latestCompletionDates: Record<squareId,
isoString>` from `getCompletions(cardId)` — a reduce that keeps whichever
completion has the latest `completedAt` per square.

Replace it with `latestCompletionsBySquareId: Record<squareId, Completion>`,
same reduce logic, but keeping the whole `Completion` object (already typed
with `note?: string` and `photoPath?: string` in
[completions.ts](../../../src/lib/firestore/completions.ts)) instead of
just the date string. Anywhere the route needs the date
(`ExportSquare`'s `latestCompletionDate` prop), it now reads
`.completedAt.toISOString()` off this map — no change in what's displayed
there.

A square is a **footnote candidate** when its latest completion has a
`note` and/or a `photoPath`. Candidates are numbered 1..N in board reading
order (slot position 0 → last), matching how the board itself is laid out.

For each candidate with a `photoPath`, resolve a signed URL with the
existing `getCompletionPhotoSignedUrl` (from
[storage.ts](../../../src/lib/firebase/storage.ts)), in parallel via
`Promise.all`, each call wrapped in its own try/catch. If a signed URL
fails to generate:
- If the candidate also has a note, it stays a footnote entry, just
  without a thumbnail.
- If it had no note (photo was its only reason to be a candidate), it's
  dropped from the footnote list entirely — no orphaned badge pointing at
  an empty entry.

`next/og`'s `ImageResponse` (satori) fetches remote `<img src>` URLs
server-side and embeds them, the same way it would for any other image —
no separate download/base64 step is needed in route code.

## Board marker

Each footnote-candidate square renders a small numbered circle badge in
its top-right corner, positioned inside the cell's own padding (not
bleeding past the edge) so it isn't clipped by the cell's existing
`overflow: hidden`. Visually it reuses the existing "B!" badge look from
`BingoBadge` in [bingo-mark.tsx](../../../src/lib/cards/bingo-mark.tsx): a
solid-color circle, cream border, bold Fredoka number — rendered as a
`div` (not SVG `<text>`, which satori doesn't support), same as that
existing component.

A square with neither a note nor a photo on its latest completion renders
exactly as it does today — the badge is purely additive markup gated on
the same condition that makes a square a footnote candidate.

## Footnote section

A new section renders below the existing brand-credit footer, only when
there's at least one footnote candidate. It has a small "Notes" heading,
then one row per candidate in badge order:

- The numbered badge (same visual as the board marker).
- The square's label, single-line-clamped (mirrors the label truncation
  already used on the board itself).
- Up to 2 lines of note text, if the entry has one — truncated to a fixed
  character budget (~150 chars) with an ellipsis before rendering, then
  additionally reserved as a fixed 2-line-clamp height. This mirrors the
  square label's existing technique in `ExportSquare`: the reserved height
  is derived from a fixed line count, never from satori measuring the
  actual wrapped text (satori's flex/measurement quirks are called out
  repeatedly in the existing code's comments — this file leans on the same
  workaround already proven there).
- A small (~72px) photo thumbnail beside the text, if the entry has a
  resolved photo URL.

Row height is one of two fixed JS constants — one for rows with note text,
one for photo-only rows — summed in JS to get the section's total height.
Nothing about row height depends on satori measuring actual rendered
content.

## Canvas sizing

The board's own sizing math (`RESERVED_HEIGHT`, `cellSize`, etc.) stays
exactly as it is today, computed against the original fixed 1080 budget —
the board never shrinks or changes based on note/photo content.

When there's at least one footnote candidate, the image's total height
grows beyond 1080 by `gap + heading height + Σ(row heights)`. With zero
footnote candidates, total height stays exactly 1080 — byte-for-byte the
same layout as today, satisfying the "no regression for cards without
notes" acceptance criterion directly.

`ImageResponse`'s `height` option becomes this computed total instead of
the constant `CANVAS`; `width` stays `CANVAS` (1080) always — only height
grows, and only when needed.

## Error handling

- Signed URL failures are per-photo and non-fatal (see Data flow above) —
  logged via `console.error`, never thrown.
- Everything else follows the route's existing error handling: unowned/
  missing cards still 401/404 before any of this runs.

## Testing

- Extend the export-image route's existing coverage (if any automated
  test exists today — verify during planning) or add a new test asserting:
  - A card with no notes/photos on any completion renders unchanged
    (same total height as before this change).
  - A card with a note-only completion shows a footnote entry with text
    and no thumbnail.
  - A card with a photo-only completion shows a footnote entry with a
    thumbnail and no note text.
  - A card with both shows both.
  - A signed-URL failure for one photo doesn't fail the whole request.
- Manual verification (per the issue's "To verify" section):
  - Export an image for a card with a CHECK and a COUNTER square that
    each have a note — confirm the note is visible without breaking
    neighboring squares' layout.
  - Export an image for a card with no notes/photos at all — confirm
    it's unchanged (no accidental new spacing/shrinkage, still 1080×1080).
  - Try 3×3 and 5×5 cards with several long notes and photos — confirm
    the board layout still holds and the footnote section renders
    correctly below it.

## Out of scope

- No cap on the number of footnote entries — a card with many
  note/photo-bearing completions produces a taller image; this is
  accepted behavior, not a bug.
- No change to the interactive play view (`bingo-grid.tsx`) — this is
  export-image only.
