import type { Square } from "@/lib/firestore/cards";
import type { Completion } from "@/lib/firestore/completions";

/**
 * Pure logic backing the export image's "Notes" footnote section (GitHub
 * issue #64): which squares get a numbered footnote, what each entry
 * shows, and how tall the whole section is. Kept free of satori/JSX and
 * Firebase so it's unit-testable without mocking either — route.tsx wires
 * this together with data fetching and rendering.
 */

/** Notes are capped at 280 chars (see MAX_NOTE_LENGTH in completion-notes.ts); footnote entries truncate further, to keep every row's height predictable regardless of how long the original note is. */
export const NOTE_TRUNCATE_LENGTH = 150;

/** Square footprint of a footnote entry's photo thumbnail, in px. */
export const FOOTNOTE_THUMBNAIL_SIZE = 72;

// Fixed per-row heights (px), summed in JS to size the footnote section —
// never derived from satori measuring rendered text, since satori's
// flex/measurement quirks make that unreliable (see route.tsx's other
// layout comments for prior art on this exact problem).
export const FOOTNOTE_ROW_HEIGHT_WITH_NOTE = 96;
export const FOOTNOTE_ROW_HEIGHT_WITHOUT_NOTE = 80;
export const FOOTNOTE_ROW_GAP = 12;
export const FOOTNOTE_HEADING_HEIGHT = 36;
export const FOOTNOTE_SECTION_TOP_GAP = 20;

/** A square whose latest completion has a note and/or a photo, paired with that completion. */
export interface FootnoteCandidate {
  square: Square;
  completion: Completion;
}

/** A `FootnoteCandidate` with its photo's signed URL already resolved (`undefined` if it had no photo, or resolution failed). */
export interface ResolvedFootnoteCandidate extends FootnoteCandidate {
  photoUrl: string | undefined;
}

/** A finalized, numbered row for the footnote section. */
export interface FootnoteEntry {
  number: number;
  squareId: string;
  label: string;
  note: string | undefined;
  photoUrl: string | undefined;
}

/**
 * Finds every square (in board reading order) whose latest completion has a
 * note and/or a photo. `slots` is the board's position-ordered square list
 * (including `undefined` gaps), matching route.tsx's existing `slots`
 * array.
 */
export function getFootnoteCandidateSquares(
  slots: (Square | undefined)[],
  latestCompletionsBySquareId: Record<string, Completion>,
): FootnoteCandidate[] {
  const candidates: FootnoteCandidate[] = [];
  for (const square of slots) {
    if (!square) continue;
    const completion = latestCompletionsBySquareId[square.id];
    if (!completion) continue;
    if (completion.note || completion.photoPath) {
      candidates.push({ square, completion });
    }
  }
  return candidates;
}

/** Truncates a note to `maxLength` characters, appending "…" if it was cut. */
export function truncateNote(note: string, maxLength = NOTE_TRUNCATE_LENGTH): string {
  if (note.length <= maxLength) return note;
  return `${note.slice(0, maxLength).trimEnd()}…`;
}

/**
 * Builds the final numbered footnote list from resolved candidates.
 * Numbers are assigned only to entries that survive — a photo-only
 * candidate whose signed URL failed to resolve, and which had no note
 * either, is dropped rather than producing an empty entry (and its board
 * badge is dropped along with it, via `footnoteNumberBySquareId`).
 */
export function buildFootnoteEntries(candidates: ResolvedFootnoteCandidate[]): FootnoteEntry[] {
  const entries: FootnoteEntry[] = [];
  for (const { square, completion, photoUrl } of candidates) {
    const note = completion.note ? truncateNote(completion.note) : undefined;
    if (!note && !photoUrl) continue;
    entries.push({
      number: entries.length + 1,
      squareId: square.id,
      label: square.label,
      note,
      photoUrl,
    });
  }
  return entries;
}

/** Maps each entry's square id to its footnote number, for the board's corner badge. */
export function footnoteNumberBySquareId(entries: FootnoteEntry[]): Record<string, number> {
  return Object.fromEntries(entries.map((entry) => [entry.squareId, entry.number]));
}

/**
 * Total height (px) of the footnote section, including its top gap and
 * heading — 0 when there are no entries, so the canvas stays exactly its
 * original 1080px for cards with nothing to report.
 */
export function computeFootnoteSectionHeight(entries: FootnoteEntry[]): number {
  if (entries.length === 0) return 0;
  const rowsHeight = entries.reduce(
    (total, entry) =>
      total + (entry.note ? FOOTNOTE_ROW_HEIGHT_WITH_NOTE : FOOTNOTE_ROW_HEIGHT_WITHOUT_NOTE),
    0,
  );
  const gapsHeight = FOOTNOTE_ROW_GAP * (entries.length - 1);
  return FOOTNOTE_SECTION_TOP_GAP + FOOTNOTE_HEADING_HEIGHT + rowsHeight + gapsHeight;
}
