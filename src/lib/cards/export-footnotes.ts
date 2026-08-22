import type { Square } from "@/lib/firestore/cards";
import type { Completion } from "@/lib/firestore/completions";

/**
 * Pure logic backing the export image's "Notes" footnote section (GitHub
 * issue #64): which squares get a numbered footnote block, what each
 * block's entries show, and how tall the whole section is. Kept free of
 * satori/JSX and Firebase so it's unit-testable without mocking either —
 * route.tsx wires this together with data fetching and rendering.
 *
 * v2: a square's footnote block includes EVERY completion with a note
 * and/or photo, not just its latest one — see
 * docs/superpowers/specs/2026-08-18-export-image-notes-photos-v2-design.md.
 */

/** Notes are capped at 280 chars (see MAX_NOTE_LENGTH in completion-notes.ts); footnote entries truncate further, to keep every tile's height predictable regardless of how long the original note is. */
export const NOTE_TRUNCATE_LENGTH = 150;

// Fixed sizes (px), summed in JS to size the footnote section — never
// derived from satori measuring rendered text, since satori's flex/
// measurement quirks make that unreliable (see route.tsx's other layout
// comments for prior art on this exact problem).
export const FOOTNOTE_SECTION_TOP_GAP = 20;
export const FOOTNOTE_HEADING_HEIGHT = 36;
/** Height of a block's badge+label header row, including the gap before its first entry. */
export const FOOTNOTE_BLOCK_HEADER_HEIGHT = 38;
/** Left indent of a block's entry grid, aligning it under the header's label (badge diameter + gap). */
export const FOOTNOTE_GRID_INDENT = 38;
export const FOOTNOTE_GRID_GAP = 16;
/** Number of tiles per row in a block's entry grid. */
export const FOOTNOTE_GRID_COLUMNS = 4;
/** Height of a tile's caption strip (date, and note when the tile also has a photo) below its square photo/text area. */
export const FOOTNOTE_TILE_CAPTION_HEIGHT = 64;
export const FOOTNOTE_BLOCK_GAP = 16;

/** Width of one square tile in a block's entry grid, given the grid's available width (i.e. the footnote section's width minus `FOOTNOTE_GRID_INDENT`). */
export function computeFootnoteTileWidth(gridWidth: number, columns = FOOTNOTE_GRID_COLUMNS): number {
  return (gridWidth - FOOTNOTE_GRID_GAP * (columns - 1)) / columns;
}

/** A square with at least one completion that has a note and/or a photo, paired with just those qualifying completions (oldest first). */
export interface FootnoteBlockCandidate {
  square: Square;
  completions: Completion[];
}

/** One qualifying completion with its photo's signed URL already resolved (`undefined` if it had no photo, or resolution failed). */
export interface ResolvedCompletionEntry {
  completion: Completion;
  photoUrl: string | undefined;
}

/** A `FootnoteBlockCandidate` with every completion's photo URL already resolved. */
export interface ResolvedFootnoteBlockCandidate {
  square: Square;
  entries: ResolvedCompletionEntry[];
}

/** One dated row inside a footnote block. */
export interface FootnoteHistoryEntry {
  date: string;
  note: string | undefined;
  photoUrl: string | undefined;
}

/** A finalized, numbered block for the footnote section — one per square that has anything to report. */
export interface FootnoteBlock {
  number: number;
  squareId: string;
  label: string;
  entries: FootnoteHistoryEntry[];
}

/**
 * Finds every square (in board reading order) with at least one completion
 * that has a note and/or a photo, and pairs it with just those qualifying
 * completions, sorted oldest first (matching the completion-history
 * modal's own ordering). `slots` is the board's position-ordered square
 * list (including `undefined` gaps); `completionsBySquareId` need not be
 * pre-filtered or pre-sorted.
 */
export function getFootnoteBlockCandidates(
  slots: (Square | undefined)[],
  completionsBySquareId: Record<string, Completion[]>,
): FootnoteBlockCandidate[] {
  const candidates: FootnoteBlockCandidate[] = [];
  for (const square of slots) {
    if (!square) continue;
    const all = completionsBySquareId[square.id] ?? [];
    const qualifying = all
      .filter((completion) => completion.note || completion.photoPath)
      .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
    if (qualifying.length > 0) {
      candidates.push({ square, completions: qualifying });
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
 * Builds the final numbered block list from resolved candidates. Within
 * each block, an entry whose photo failed to resolve and which has no note
 * either is dropped; if every entry in a block is dropped this way, the
 * whole block — and its board badge — is dropped too, via
 * `footnoteNumberBySquareId`.
 */
export function buildFootnoteBlocks(candidates: ResolvedFootnoteBlockCandidate[]): FootnoteBlock[] {
  const blocks: FootnoteBlock[] = [];
  for (const { square, entries: resolvedEntries } of candidates) {
    const entries: FootnoteHistoryEntry[] = [];
    for (const { completion, photoUrl } of resolvedEntries) {
      const note = completion.note ? truncateNote(completion.note) : undefined;
      if (!note && !photoUrl) continue;
      entries.push({ date: completion.completedAt.toISOString(), note, photoUrl });
    }
    if (entries.length === 0) continue;
    blocks.push({
      number: blocks.length + 1,
      squareId: square.id,
      label: square.label,
      entries,
    });
  }
  return blocks;
}

/** Maps each block's square id to its footnote number, for the board's corner badge. */
export function footnoteNumberBySquareId(blocks: FootnoteBlock[]): Record<string, number> {
  return Object.fromEntries(blocks.map((block) => [block.squareId, block.number]));
}

/**
 * Total height (px) of the footnote section, including its top gap and
 * heading — 0 when there are no blocks, so the canvas stays exactly its
 * original 1080px for cards with nothing to report. `width` is the
 * footnote section's full width (matching the board's content width), used
 * to derive each block's tile size and wrap its entries into rows exactly
 * as `ExportFootnotes` will render them.
 */
export function computeFootnoteSectionHeight(blocks: FootnoteBlock[], width: number): number {
  if (blocks.length === 0) return 0;
  const tileWidth = computeFootnoteTileWidth(width - FOOTNOTE_GRID_INDENT);
  const tileHeight = tileWidth + FOOTNOTE_TILE_CAPTION_HEIGHT;
  const blocksHeight = blocks.reduce((total, block) => {
    const rows = Math.ceil(block.entries.length / FOOTNOTE_GRID_COLUMNS);
    const gridHeight = rows * tileHeight + FOOTNOTE_GRID_GAP * (rows - 1);
    return total + FOOTNOTE_BLOCK_HEADER_HEIGHT + gridHeight;
  }, 0);
  const blockGaps = FOOTNOTE_BLOCK_GAP * (blocks.length - 1);
  return FOOTNOTE_SECTION_TOP_GAP + FOOTNOTE_HEADING_HEIGHT + blocksHeight + blockGaps;
}
