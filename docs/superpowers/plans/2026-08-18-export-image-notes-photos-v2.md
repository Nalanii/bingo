# Export Image Notes/Photos v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the exported card image's "Notes" footnote section (GitHub issue #64) so a square shows a note/photo from **any** of its completions, not just its latest one — closing the gap found during live testing (a note on completion #6 of 7 was invisible because completion #7 had nothing).

**Architecture:** Replace `src/lib/cards/export-footnotes.ts`'s per-latest-completion candidate logic with per-square-history grouping: for each square, collect every completion with a note and/or photo (oldest first), and if any exist, render one numbered "block" in the footnote section listing all of them (each with its own date, note, and/or photo thumbnail). The board still gets exactly one badge per square. `src/app/dashboard/cards/[id]/export-image/image/route.tsx` is updated to group completions by square (instead of reducing to just the latest) and to render the new block-based `ExportFootnotes` layout. `src/components/export-image-viewer.tsx` needs no changes — its fix (natural-height, non-square images) already works for whatever height the route produces.

**Tech Stack:** Next.js 16 Route Handler, `next/og` (`ImageResponse`/satori), Vitest.

**Design doc:** `docs/superpowers/specs/2026-08-18-export-image-notes-photos-v2-design.md` (revises `docs/superpowers/specs/2026-08-18-export-image-notes-photos-design.md`)

---

## File structure

- Replace the full contents of `src/lib/cards/export-footnotes.ts` and `src/lib/cards/export-footnotes.test.ts` — the pure logic and its tests, rewritten for per-square-history grouping instead of per-latest-completion.
- Modify `src/app/dashboard/cards/[id]/export-image/image/route.tsx` — regroup completions by square (in addition to, not instead of, the existing latest-completion lookup used for the board's date caption), and rewrite `ExportFootnotes` to render one block per square.

---

### Task 1: Rewrite `export-footnotes.ts` for per-square-history grouping

**Files:**
- Modify (full replace): `src/lib/cards/export-footnotes.ts`
- Modify (full replace): `src/lib/cards/export-footnotes.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/lib/cards/export-footnotes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Square } from "@/lib/firestore/cards";
import type { Completion } from "@/lib/firestore/completions";
import {
  FOOTNOTE_BLOCK_GAP,
  FOOTNOTE_BLOCK_HEADER_HEIGHT,
  FOOTNOTE_ENTRY_ROW_GAP,
  FOOTNOTE_ENTRY_ROW_HEIGHT_WITH_NOTE,
  FOOTNOTE_ENTRY_ROW_HEIGHT_WITHOUT_NOTE,
  FOOTNOTE_HEADING_HEIGHT,
  FOOTNOTE_SECTION_TOP_GAP,
  NOTE_TRUNCATE_LENGTH,
  buildFootnoteBlocks,
  computeFootnoteSectionHeight,
  footnoteNumberBySquareId,
  getFootnoteBlockCandidates,
  truncateNote,
} from "./export-footnotes";

function makeSquare(overrides: Partial<Square> = {}): Square {
  return {
    id: "square-1",
    position: 0,
    label: "Make 10 Junk Journaling Spreads",
    kind: "COUNTER",
    goal: 10,
    isFreeSpace: false,
    ...overrides,
  };
}

function makeCompletion(overrides: Partial<Completion> = {}): Completion {
  return {
    id: "completion-1",
    squareId: "square-1",
    completedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("getFootnoteBlockCandidates", () => {
  it("includes a square if ANY of its completions has a note or photo, not just the latest", () => {
    const square = makeSquare({ id: "a" });
    const older = makeCompletion({ id: "c1", squareId: "a", completedAt: new Date("2026-07-06"), note: "test" });
    const latest = makeCompletion({ id: "c2", squareId: "a", completedAt: new Date("2026-07-24") });

    const candidates = getFootnoteBlockCandidates([square], { a: [latest, older] });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].completions.map((c) => c.id)).toEqual(["c1"]);
  });

  it("sorts a square's qualifying completions oldest first regardless of input order", () => {
    const square = makeSquare({ id: "a" });
    const newer = makeCompletion({ id: "newer", squareId: "a", completedAt: new Date("2026-06-01"), note: "second" });
    const older = makeCompletion({ id: "older", squareId: "a", completedAt: new Date("2026-01-01"), note: "first" });

    const candidates = getFootnoteBlockCandidates([square], { a: [newer, older] });

    expect(candidates[0].completions.map((c) => c.id)).toEqual(["older", "newer"]);
  });

  it("skips squares with no qualifying completions and preserves board order", () => {
    const withNote = makeSquare({ id: "a", position: 0 });
    const withNeither = makeSquare({ id: "b", position: 1 });
    const withPhoto = makeSquare({ id: "c", position: 2 });

    const candidates = getFootnoteBlockCandidates([withNote, withNeither, withPhoto], {
      a: [makeCompletion({ squareId: "a", note: "hi" })],
      b: [makeCompletion({ squareId: "b" })],
      c: [makeCompletion({ squareId: "c", photoPath: "path.png" })],
    });

    expect(candidates.map((c) => c.square.id)).toEqual(["a", "c"]);
  });

  it("skips empty board slots and squares with no completions at all", () => {
    const square = makeSquare({ id: "a" });

    const candidates = getFootnoteBlockCandidates([undefined, square], {});

    expect(candidates).toEqual([]);
  });
});

describe("truncateNote", () => {
  it("returns short notes unchanged", () => {
    expect(truncateNote("Short note")).toBe("Short note");
  });

  it("truncates long notes with an ellipsis at the max length", () => {
    const longNote = "a".repeat(NOTE_TRUNCATE_LENGTH + 20);

    expect(truncateNote(longNote)).toBe(`${"a".repeat(NOTE_TRUNCATE_LENGTH)}…`);
  });
});

describe("buildFootnoteBlocks", () => {
  it("numbers blocks sequentially in candidate order", () => {
    const blocks = buildFootnoteBlocks([
      { square: makeSquare({ id: "a" }), entries: [{ completion: makeCompletion({ note: "First" }), photoUrl: undefined }] },
      { square: makeSquare({ id: "b" }), entries: [{ completion: makeCompletion({ note: "Second" }), photoUrl: undefined }] },
    ]);

    expect(blocks.map((b) => b.number)).toEqual([1, 2]);
    expect(blocks.map((b) => b.squareId)).toEqual(["a", "b"]);
  });

  it("includes multiple entries in one block, in the given order", () => {
    const blocks = buildFootnoteBlocks([
      {
        square: makeSquare(),
        entries: [
          { completion: makeCompletion({ completedAt: new Date("2026-01-01"), note: "First" }), photoUrl: undefined },
          { completion: makeCompletion({ completedAt: new Date("2026-02-01"), note: "Second" }), photoUrl: undefined },
        ],
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].entries).toHaveLength(2);
    expect(blocks[0].entries[0].note).toBe("First");
    expect(blocks[0].entries[1].note).toBe("Second");
  });

  it("keeps a photo-only entry with a resolved photoUrl", () => {
    const blocks = buildFootnoteBlocks([
      {
        square: makeSquare(),
        entries: [{ completion: makeCompletion({ photoPath: "path.png" }), photoUrl: "https://storage.example/signed" }],
      },
    ]);

    expect(blocks[0].entries[0].note).toBeUndefined();
    expect(blocks[0].entries[0].photoUrl).toBe("https://storage.example/signed");
  });

  it("drops an entry whose photo failed to resolve and has no note, without dropping siblings", () => {
    const blocks = buildFootnoteBlocks([
      {
        square: makeSquare(),
        entries: [
          { completion: makeCompletion({ id: "ok", note: "Keep me" }), photoUrl: undefined },
          { completion: makeCompletion({ id: "fails", photoPath: "path.png" }), photoUrl: undefined },
        ],
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].entries).toHaveLength(1);
    expect(blocks[0].entries[0].note).toBe("Keep me");
  });

  it("drops the whole block when every entry fails to resolve", () => {
    const blocks = buildFootnoteBlocks([
      {
        square: makeSquare(),
        entries: [{ completion: makeCompletion({ photoPath: "path.png" }), photoUrl: undefined }],
      },
    ]);

    expect(blocks).toEqual([]);
  });

  it("truncates note text", () => {
    const longNote = "b".repeat(NOTE_TRUNCATE_LENGTH + 5);

    const blocks = buildFootnoteBlocks([
      { square: makeSquare(), entries: [{ completion: makeCompletion({ note: longNote }), photoUrl: undefined }] },
    ]);

    expect(blocks[0].entries[0].note).toBe(truncateNote(longNote));
  });
});

describe("footnoteNumberBySquareId", () => {
  it("maps each block's square id to its number", () => {
    const map = footnoteNumberBySquareId([
      { number: 1, squareId: "a", label: "A", entries: [] },
      { number: 2, squareId: "b", label: "B", entries: [] },
    ]);

    expect(map).toEqual({ a: 1, b: 2 });
  });
});

describe("computeFootnoteSectionHeight", () => {
  it("is 0 for an empty block list", () => {
    expect(computeFootnoteSectionHeight([])).toBe(0);
  });

  it("sums heading, header, gaps, and per-entry heights for a single block", () => {
    const blocks = [
      {
        number: 1,
        squareId: "a",
        label: "A",
        entries: [
          { date: "2026-01-01T00:00:00.000Z", note: "has a note", photoUrl: undefined },
          { date: "2026-02-01T00:00:00.000Z", note: undefined, photoUrl: "url" },
        ],
      },
    ];

    const height = computeFootnoteSectionHeight(blocks);

    expect(height).toBe(
      FOOTNOTE_SECTION_TOP_GAP +
        FOOTNOTE_HEADING_HEIGHT +
        FOOTNOTE_BLOCK_HEADER_HEIGHT +
        FOOTNOTE_ENTRY_ROW_HEIGHT_WITH_NOTE +
        FOOTNOTE_ENTRY_ROW_HEIGHT_WITHOUT_NOTE +
        FOOTNOTE_ENTRY_ROW_GAP * 1,
    );
  });

  it("sums across multiple blocks including the gap between them", () => {
    const blocks = [
      {
        number: 1,
        squareId: "a",
        label: "A",
        entries: [{ date: "2026-01-01T00:00:00.000Z", note: "note", photoUrl: undefined }],
      },
      {
        number: 2,
        squareId: "b",
        label: "B",
        entries: [{ date: "2026-01-01T00:00:00.000Z", note: undefined, photoUrl: "url" }],
      },
    ];

    const height = computeFootnoteSectionHeight(blocks);

    expect(height).toBe(
      FOOTNOTE_SECTION_TOP_GAP +
        FOOTNOTE_HEADING_HEIGHT +
        (FOOTNOTE_BLOCK_HEADER_HEIGHT + FOOTNOTE_ENTRY_ROW_HEIGHT_WITH_NOTE) +
        (FOOTNOTE_BLOCK_HEADER_HEIGHT + FOOTNOTE_ENTRY_ROW_HEIGHT_WITHOUT_NOTE) +
        FOOTNOTE_BLOCK_GAP * 1,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- export-footnotes`
Expected: FAIL — the old `export-footnotes.ts` doesn't export `getFootnoteBlockCandidates`, `buildFootnoteBlocks`, or the new constants yet.

- [ ] **Step 3: Implement the new `export-footnotes.ts`**

Replace the full contents of `src/lib/cards/export-footnotes.ts`:

```ts
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

/** Notes are capped at 280 chars (see MAX_NOTE_LENGTH in completion-notes.ts); footnote entries truncate further, to keep every row's height predictable regardless of how long the original note is. */
export const NOTE_TRUNCATE_LENGTH = 150;

/** Square footprint of a footnote entry's photo thumbnail, in px. */
export const FOOTNOTE_THUMBNAIL_SIZE = 72;

// Fixed heights (px), summed in JS to size the footnote section — never
// derived from satori measuring rendered text, since satori's flex/
// measurement quirks make that unreliable (see route.tsx's other layout
// comments for prior art on this exact problem).
export const FOOTNOTE_SECTION_TOP_GAP = 20;
export const FOOTNOTE_HEADING_HEIGHT = 36;
/** Height of a block's badge+label header row, including the gap before its first entry. */
export const FOOTNOTE_BLOCK_HEADER_HEIGHT = 38;
export const FOOTNOTE_ENTRY_ROW_HEIGHT_WITH_NOTE = 84;
export const FOOTNOTE_ENTRY_ROW_HEIGHT_WITHOUT_NOTE = 76;
export const FOOTNOTE_ENTRY_ROW_GAP = 8;
export const FOOTNOTE_BLOCK_GAP = 16;

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
 * original 1080px for cards with nothing to report.
 */
export function computeFootnoteSectionHeight(blocks: FootnoteBlock[]): number {
  if (blocks.length === 0) return 0;
  const blocksHeight = blocks.reduce((total, block) => {
    const entriesHeight = block.entries.reduce(
      (sum, entry) =>
        sum + (entry.note ? FOOTNOTE_ENTRY_ROW_HEIGHT_WITH_NOTE : FOOTNOTE_ENTRY_ROW_HEIGHT_WITHOUT_NOTE),
      0,
    );
    const entryGaps = FOOTNOTE_ENTRY_ROW_GAP * (block.entries.length - 1);
    return total + FOOTNOTE_BLOCK_HEADER_HEIGHT + entriesHeight + entryGaps;
  }, 0);
  const blockGaps = FOOTNOTE_BLOCK_GAP * (blocks.length - 1);
  return FOOTNOTE_SECTION_TOP_GAP + FOOTNOTE_HEADING_HEIGHT + blocksHeight + blockGaps;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- export-footnotes`
Expected: PASS — all tests green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (`route.tsx` will fail to typecheck at this point since it still imports the old symbol names — that's expected and fixed in Task 2. If `npm run typecheck` is run for the whole project rather than just this file, ignore `route.tsx` errors for now.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/cards/export-footnotes.ts src/lib/cards/export-footnotes.test.ts
git commit -m "feat: show every note/photo-bearing completion per square, not just the latest

Assisted by Claude."
```

---

### Task 2: Rewrite `route.tsx`'s footnote data flow and rendering

**Files:**
- Modify: `src/app/dashboard/cards/[id]/export-image/image/route.tsx`

- [ ] **Step 1: Update the `export-footnotes` import list**

Find:

```tsx
import {
  FOOTNOTE_HEADING_HEIGHT,
  FOOTNOTE_ROW_GAP,
  FOOTNOTE_ROW_HEIGHT_WITH_NOTE,
  FOOTNOTE_ROW_HEIGHT_WITHOUT_NOTE,
  FOOTNOTE_SECTION_TOP_GAP,
  FOOTNOTE_THUMBNAIL_SIZE,
  buildFootnoteEntries,
  computeFootnoteSectionHeight,
  footnoteNumberBySquareId,
  getFootnoteCandidateSquares,
  type FootnoteEntry,
} from "@/lib/cards/export-footnotes";
```

Replace with:

```tsx
import {
  FOOTNOTE_BLOCK_GAP,
  FOOTNOTE_BLOCK_HEADER_HEIGHT,
  FOOTNOTE_ENTRY_ROW_GAP,
  FOOTNOTE_ENTRY_ROW_HEIGHT_WITH_NOTE,
  FOOTNOTE_ENTRY_ROW_HEIGHT_WITHOUT_NOTE,
  FOOTNOTE_HEADING_HEIGHT,
  FOOTNOTE_SECTION_TOP_GAP,
  FOOTNOTE_THUMBNAIL_SIZE,
  buildFootnoteBlocks,
  computeFootnoteSectionHeight,
  footnoteNumberBySquareId,
  getFootnoteBlockCandidates,
  type FootnoteBlock,
} from "@/lib/cards/export-footnotes";
```

- [ ] **Step 2: Group completions by square, and build footnote blocks instead of single-entry candidates**

Find:

```tsx
  const completions = await getCompletions(id);
  const countsBySquareId = countCompletionsBySquare(completions);
  const latestCompletionsBySquareId = completions.reduce<Record<string, Completion>>(
    (latest, completion) => {
      const existing = latest[completion.squareId];
      if (!existing || completion.completedAt > existing.completedAt) {
        latest[completion.squareId] = completion;
      }
      return latest;
    },
    {},
  );

  const squaresByPosition = new Map(card.squares.map((square) => [square.position, square]));
  const slotCount = card.gridSize * card.gridSize;
  const slots = Array.from({ length: slotCount }, (_, position) => squaresByPosition.get(position));

  // Each square whose latest completion has a note and/or a photo gets a
  // numbered footnote — see
  // docs/superpowers/specs/2026-08-18-export-image-notes-photos-design.md.
  const footnoteCandidates = getFootnoteCandidateSquares(slots, latestCompletionsBySquareId);
  const resolvedFootnoteCandidates = await Promise.all(
    footnoteCandidates.map(async (candidate) => {
      if (!candidate.completion.photoPath) {
        return { ...candidate, photoUrl: undefined };
      }
      try {
        const photoUrl = await getCompletionPhotoSignedUrl(candidate.completion.photoPath);
        return { ...candidate, photoUrl };
      } catch (error) {
        console.error("export-image: failed to sign completion photo URL", error);
        return { ...candidate, photoUrl: undefined };
      }
    }),
  );
  const footnoteEntries = buildFootnoteEntries(resolvedFootnoteCandidates);
  const footnoteNumbers = footnoteNumberBySquareId(footnoteEntries);
  const footnoteSectionHeight = computeFootnoteSectionHeight(footnoteEntries);
```

Replace with:

```tsx
  const completions = await getCompletions(id);
  const countsBySquareId = countCompletionsBySquare(completions);
  const latestCompletionsBySquareId = completions.reduce<Record<string, Completion>>(
    (latest, completion) => {
      const existing = latest[completion.squareId];
      if (!existing || completion.completedAt > existing.completedAt) {
        latest[completion.squareId] = completion;
      }
      return latest;
    },
    {},
  );
  const completionsBySquareId = completions.reduce<Record<string, Completion[]>>((bySquare, completion) => {
    (bySquare[completion.squareId] ??= []).push(completion);
    return bySquare;
  }, {});

  const squaresByPosition = new Map(card.squares.map((square) => [square.position, square]));
  const slotCount = card.gridSize * card.gridSize;
  const slots = Array.from({ length: slotCount }, (_, position) => squaresByPosition.get(position));

  // Every square with at least one completion that has a note and/or a
  // photo gets a numbered footnote block listing all of them — see
  // docs/superpowers/specs/2026-08-18-export-image-notes-photos-v2-design.md.
  const footnoteBlockCandidates = getFootnoteBlockCandidates(slots, completionsBySquareId);
  const resolvedFootnoteBlockCandidates = await Promise.all(
    footnoteBlockCandidates.map(async (candidate) => ({
      square: candidate.square,
      entries: await Promise.all(
        candidate.completions.map(async (completion) => {
          if (!completion.photoPath) {
            return { completion, photoUrl: undefined };
          }
          try {
            const photoUrl = await getCompletionPhotoSignedUrl(completion.photoPath);
            return { completion, photoUrl };
          } catch (error) {
            console.error("export-image: failed to sign completion photo URL", error);
            return { completion, photoUrl: undefined };
          }
        }),
      ),
    })),
  );
  const footnoteBlocks = buildFootnoteBlocks(resolvedFootnoteBlockCandidates);
  const footnoteNumbers = footnoteNumberBySquareId(footnoteBlocks);
  const footnoteSectionHeight = computeFootnoteSectionHeight(footnoteBlocks);
```

Note: `latestCompletionsBySquareId` is kept unchanged and still used below for the board's `latestCompletionDate` prop (the "Completed:"/"Last completed:" caption) — that stays tied to the true latest completion regardless of notes, per the design.

- [ ] **Step 3: Rewrite `ExportFootnotes` to render blocks**

Find the full `ExportFootnotes` function:

```tsx
/**
 * The "Notes" section below the board: one row per footnote-candidate
 * square, in the same numbered order as their corner badges. Renders
 * nothing when `entries` is empty, so cards with no notes/photos get no
 * extra markup at all.
 */
function ExportFootnotes({ entries, width }: { entries: FootnoteEntry[]; width: number }) {
  if (entries.length === 0) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: FOOTNOTE_SECTION_TOP_GAP, width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", width }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: FOOTNOTE_HEADING_HEIGHT,
            fontFamily: "Fredoka",
            fontSize: 24,
            fontWeight: 700,
            color: FOREGROUND,
          }}
        >
          Notes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: FOOTNOTE_ROW_GAP }}>
          {entries.map((entry) => (
            <div
              key={entry.squareId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                height: entry.note ? FOOTNOTE_ROW_HEIGHT_WITH_NOTE : FOOTNOTE_ROW_HEIGHT_WITHOUT_NOTE,
              }}
            >
              <FootnoteBadge number={entry.number} diameter={32} />
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, justifyContent: "center" }}>
                <div
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: 20,
                    fontWeight: 700,
                    color: FOREGROUND,
                    maxHeight: 24,
                  }}
                >
                  {entry.label}
                </div>
                {entry.note && (
                  <div
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: 4,
                      fontSize: 17,
                      lineHeight: 1.3,
                      color: MUTED_FOREGROUND,
                      maxHeight: 17 * 1.3 * 2,
                    }}
                  >
                    {entry.note}
                  </div>
                )}
              </div>
              {entry.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- satori (next/og's ImageResponse) requires a plain <img>, not next/image.
                <img
                  src={entry.photoUrl}
                  alt=""
                  width={FOOTNOTE_THUMBNAIL_SIZE}
                  height={FOOTNOTE_THUMBNAIL_SIZE}
                  style={{
                    width: FOOTNOTE_THUMBNAIL_SIZE,
                    height: FOOTNOTE_THUMBNAIL_SIZE,
                    borderRadius: 10,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Replace with:

```tsx
/**
 * The "Notes" section below the board: one block per square that has at
 * least one completion with a note and/or a photo, in the same numbered
 * order as their corner badges. Each block lists every qualifying
 * completion, oldest first, with its own date/note/photo. Renders nothing
 * when `blocks` is empty, so cards with no notes/photos get no extra
 * markup at all.
 */
function ExportFootnotes({ blocks, width }: { blocks: FootnoteBlock[]; width: number }) {
  if (blocks.length === 0) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: FOOTNOTE_SECTION_TOP_GAP, width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", width }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: FOOTNOTE_HEADING_HEIGHT,
            fontFamily: "Fredoka",
            fontSize: 24,
            fontWeight: 700,
            color: FOREGROUND,
          }}
        >
          Notes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: FOOTNOTE_BLOCK_GAP }}>
          {blocks.map((block) => (
            <div key={block.squareId} style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  height: FOOTNOTE_BLOCK_HEADER_HEIGHT,
                }}
              >
                <FootnoteBadge number={block.number} diameter={28} />
                <div
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: 20,
                    fontWeight: 700,
                    color: FOREGROUND,
                    maxHeight: 24,
                  }}
                >
                  {block.label}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: FOOTNOTE_ENTRY_ROW_GAP }}>
                {block.entries.map((entry, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      paddingLeft: 38,
                      height: entry.note ? FOOTNOTE_ENTRY_ROW_HEIGHT_WITH_NOTE : FOOTNOTE_ENTRY_ROW_HEIGHT_WITHOUT_NOTE,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, justifyContent: "center" }}>
                      <div style={{ display: "flex", fontSize: 14, fontStyle: "italic", color: MUTED_FOREGROUND }}>
                        {formatDate(entry.date)}
                      </div>
                      {entry.note && (
                        <div
                          style={{
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            marginTop: 4,
                            fontSize: 17,
                            lineHeight: 1.3,
                            color: MUTED_FOREGROUND,
                            maxHeight: 17 * 1.3 * 2,
                          }}
                        >
                          {entry.note}
                        </div>
                      )}
                    </div>
                    {entry.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- satori (next/og's ImageResponse) requires a plain <img>, not next/image.
                      <img
                        src={entry.photoUrl}
                        alt=""
                        width={FOOTNOTE_THUMBNAIL_SIZE}
                        height={FOOTNOTE_THUMBNAIL_SIZE}
                        style={{
                          width: FOOTNOTE_THUMBNAIL_SIZE,
                          height: FOOTNOTE_THUMBNAIL_SIZE,
                          borderRadius: 10,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Note: `formatDate` is the existing helper already defined near the top of this file (`function formatDate(iso: string): string`) — don't redefine it, just call it.

- [ ] **Step 4: Update the `ExportFootnotes` call site**

Find:

```tsx
      <ExportFootnotes entries={footnoteEntries} width={contentWidth} />
```

Replace with:

```tsx
      <ExportFootnotes blocks={footnoteBlocks} width={contentWidth} />
```

(The `ExportSquare` call site's `footnoteNumber={footnoteNumbers[square.id]}` line does **not** need to change — `footnoteNumbers` is still the variable name, just now derived from `footnoteBlocks` instead of the old `footnoteEntries`.)

- [ ] **Step 5: Typecheck, lint, build**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/cards/[id]/export-image/image/route.tsx
git commit -m "feat: render one Notes block per square listing every note/photo-bearing completion

Assisted by Claude."
```

---

## Manual verification (after both tasks)

1. Ask before starting a preview/dev server if one isn't already running.
2. Open the card and square used to find this bug ("Make 10 Junk Journaling Spreads", a COUNTER square with a note "test" and a photo on an older completion, not its latest). Export the image and confirm a "Notes" block now appears for that square, showing the dated entry with its note and photo — even though the square's latest completion has neither.
3. Add a second note to a different (also non-latest) completion on the same square, export again, and confirm the block now lists both entries, oldest first.
4. Export a card with no notes/photos on any completion at all — confirm it's unchanged (still exactly 1080×1080, no extra markup).
5. Try a 3×3 and a 5×5 card with several squares that each have multiple note/photo-bearing completions — confirm the board layout still holds and the footnote section's blocks render without overlap, growing the canvas as needed.
