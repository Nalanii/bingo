# Export Image Notes & Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each square's latest completion note and/or photo in the exported card image (`/dashboard/cards/[id]/export-image`), via a numbered footnote system, closing [GitHub issue #64](https://github.com/Nalanii/bingo/issues/64).

**Architecture:** A square whose latest completion has a note and/or photo gets a small numbered badge in its corner on the board; a "Notes" section below the board lists one entry per badge (label, note text, photo thumbnail). The pure logic for deciding candidates, truncating notes, and computing the footnote section's height lives in a new, satori-free module (`src/lib/cards/export-footnotes.ts`) so it's unit-testable; `route.tsx` wires that logic together with data fetching and satori JSX. The board's own sizing is untouched — the canvas only grows taller, beyond its normal 1080px, when there's at least one footnote.

**Tech Stack:** Next.js 16 Route Handler, `next/og` (`ImageResponse`/satori), `firebase-admin/storage` (via existing `getCompletionPhotoSignedUrl`), Vitest.

**Design doc:** `docs/superpowers/specs/2026-08-18-export-image-notes-photos-design.md`

---

## File structure

- Create `src/lib/cards/export-footnotes.ts` — pure footnote-candidate selection, note truncation, entry building, and section-height math. No satori/JSX/Firebase in this file, so it's directly unit-testable.
- Create `src/lib/cards/export-footnotes.test.ts` — unit tests for the above.
- Modify `src/app/dashboard/cards/[id]/export-image/image/route.tsx` — data flow (keep the whole latest `Completion`, not just its date), a `FootnoteBadge` component, a corner badge on `ExportSquare`, a new `ExportFootnotes` section, and a dynamic `ImageResponse` height.
- Modify `src/components/export-image-viewer.tsx` — stop assuming the PNG is always a 1080×1080 square (it no longer is, once a card has footnotes).

---

### Task 1: `export-footnotes.ts` — pure footnote logic + tests

**Files:**
- Create: `src/lib/cards/export-footnotes.ts`
- Create: `src/lib/cards/export-footnotes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/cards/export-footnotes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Square } from "@/lib/firestore/cards";
import type { Completion } from "@/lib/firestore/completions";
import {
  FOOTNOTE_HEADING_HEIGHT,
  FOOTNOTE_ROW_GAP,
  FOOTNOTE_ROW_HEIGHT_WITH_NOTE,
  FOOTNOTE_ROW_HEIGHT_WITHOUT_NOTE,
  FOOTNOTE_SECTION_TOP_GAP,
  NOTE_TRUNCATE_LENGTH,
  buildFootnoteEntries,
  computeFootnoteSectionHeight,
  footnoteNumberBySquareId,
  getFootnoteCandidateSquares,
  truncateNote,
} from "./export-footnotes";

function makeSquare(overrides: Partial<Square> = {}): Square {
  return {
    id: "square-1",
    position: 0,
    label: "Try a new recipe",
    kind: "CHECK",
    goal: 1,
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

describe("getFootnoteCandidateSquares", () => {
  it("includes only squares whose latest completion has a note or a photo", () => {
    const withNote = makeSquare({ id: "a", position: 0 });
    const withPhoto = makeSquare({ id: "b", position: 1 });
    const withNeither = makeSquare({ id: "c", position: 2 });
    const noCompletion = makeSquare({ id: "d", position: 3 });

    const candidates = getFootnoteCandidateSquares(
      [withNote, withPhoto, withNeither, noCompletion],
      {
        a: makeCompletion({ squareId: "a", note: "Loved it" }),
        b: makeCompletion({ squareId: "b", photoPath: "completion-photos/card/b.png" }),
        c: makeCompletion({ squareId: "c" }),
      },
    );

    expect(candidates.map((c) => c.square.id)).toEqual(["a", "b"]);
  });

  it("preserves board reading order and skips empty slots", () => {
    const first = makeSquare({ id: "first", position: 0 });
    const second = makeSquare({ id: "second", position: 1 });

    const candidates = getFootnoteCandidateSquares([undefined, second, first], {
      first: makeCompletion({ squareId: "first", note: "First" }),
      second: makeCompletion({ squareId: "second", note: "Second" }),
    });

    expect(candidates.map((c) => c.square.id)).toEqual(["second", "first"]);
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

describe("buildFootnoteEntries", () => {
  it("numbers entries sequentially in candidate order", () => {
    const entries = buildFootnoteEntries([
      { square: makeSquare({ id: "a" }), completion: makeCompletion({ note: "First" }), photoUrl: undefined },
      { square: makeSquare({ id: "b" }), completion: makeCompletion({ note: "Second" }), photoUrl: undefined },
    ]);

    expect(entries.map((e) => e.number)).toEqual([1, 2]);
    expect(entries.map((e) => e.squareId)).toEqual(["a", "b"]);
  });

  it("keeps a note-only entry with no photoUrl", () => {
    const entries = buildFootnoteEntries([
      { square: makeSquare(), completion: makeCompletion({ note: "Note only" }), photoUrl: undefined },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].note).toBe("Note only");
    expect(entries[0].photoUrl).toBeUndefined();
  });

  it("keeps a photo-only entry with a resolved photoUrl", () => {
    const entries = buildFootnoteEntries([
      {
        square: makeSquare(),
        completion: makeCompletion({ photoPath: "completion-photos/card/square-1.png" }),
        photoUrl: "https://storage.example/signed-url",
      },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].note).toBeUndefined();
    expect(entries[0].photoUrl).toBe("https://storage.example/signed-url");
  });

  it("drops a photo-only entry whose signed URL failed to resolve", () => {
    const entries = buildFootnoteEntries([
      {
        square: makeSquare(),
        completion: makeCompletion({ photoPath: "completion-photos/card/square-1.png" }),
        photoUrl: undefined,
      },
    ]);

    expect(entries).toHaveLength(0);
  });

  it("truncates note text", () => {
    const longNote = "b".repeat(NOTE_TRUNCATE_LENGTH + 5);

    const entries = buildFootnoteEntries([
      { square: makeSquare(), completion: makeCompletion({ note: longNote }), photoUrl: undefined },
    ]);

    expect(entries[0].note).toBe(truncateNote(longNote));
  });
});

describe("footnoteNumberBySquareId", () => {
  it("maps each entry's square id to its number", () => {
    const map = footnoteNumberBySquareId([
      { number: 1, squareId: "a", label: "A", note: "note", photoUrl: undefined },
      { number: 2, squareId: "b", label: "B", note: undefined, photoUrl: "url" },
    ]);

    expect(map).toEqual({ a: 1, b: 2 });
  });
});

describe("computeFootnoteSectionHeight", () => {
  it("is 0 for an empty entry list", () => {
    expect(computeFootnoteSectionHeight([])).toBe(0);
  });

  it("sums heading, gaps, and per-row heights based on whether each entry has a note", () => {
    const entries = [
      { number: 1, squareId: "a", label: "A", note: "has a note", photoUrl: undefined },
      { number: 2, squareId: "b", label: "B", note: undefined, photoUrl: "url" },
    ];

    const height = computeFootnoteSectionHeight(entries);

    expect(height).toBe(
      FOOTNOTE_SECTION_TOP_GAP +
        FOOTNOTE_HEADING_HEIGHT +
        FOOTNOTE_ROW_HEIGHT_WITH_NOTE +
        FOOTNOTE_ROW_HEIGHT_WITHOUT_NOTE +
        FOOTNOTE_ROW_GAP * 1,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- export-footnotes`
Expected: FAIL — `export-footnotes.ts` doesn't exist yet (module not found).

- [ ] **Step 3: Implement `export-footnotes.ts`**

Create `src/lib/cards/export-footnotes.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- export-footnotes`
Expected: PASS — all tests green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cards/export-footnotes.ts src/lib/cards/export-footnotes.test.ts
git commit -m "feat: add pure footnote-building logic for export image notes/photos

Assisted by Claude."
```

---

### Task 2: Wire footnote data flow and board corner badge into `route.tsx`

**Files:**
- Modify: `src/app/dashboard/cards/[id]/export-image/image/route.tsx`

- [ ] **Step 1: Update imports**

Replace lines 1-6:

```tsx
import { ImageResponse } from "next/og";
import { getOwnedCard } from "@/lib/cards/access";
import { countCompletionsBySquare } from "@/lib/cards/progress";
import { getCompletions } from "@/lib/firestore/completions";
import type { Square } from "@/lib/firestore/cards";
import { BingoGlyph, loadCardFonts } from "@/lib/cards/bingo-mark";
```

with:

```tsx
import { ImageResponse } from "next/og";
import { getOwnedCard } from "@/lib/cards/access";
import { countCompletionsBySquare } from "@/lib/cards/progress";
import { getCompletions, type Completion } from "@/lib/firestore/completions";
import type { Square } from "@/lib/firestore/cards";
import { BingoGlyph, loadCardFonts } from "@/lib/cards/bingo-mark";
import { getCompletionPhotoSignedUrl } from "@/lib/firebase/storage";
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

- [ ] **Step 2: Replace the `latestCompletionDates` reduce with `latestCompletionsBySquareId`, and compute footnotes**

Find (currently around line 258):

```tsx
  const completions = await getCompletions(id);
  const countsBySquareId = countCompletionsBySquare(completions);
  const latestCompletionDates = completions.reduce<Record<string, string>>((latest, completion) => {
    const existing = latest[completion.squareId];
    if (!existing || completion.completedAt > new Date(existing)) {
      latest[completion.squareId] = completion.completedAt.toISOString();
    }
    return latest;
  }, {});

  const squaresByPosition = new Map(card.squares.map((square) => [square.position, square]));
  const slotCount = card.gridSize * card.gridSize;
  const slots = Array.from({ length: slotCount }, (_, position) => squaresByPosition.get(position));
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

- [ ] **Step 3: Add `FootnoteBadge` and extend `ExportSquare`'s props**

Find:

```tsx
const CELL_PADDING = 10;

function ExportSquare({
  square,
  count,
  cellSize,
  latestCompletionDate,
}: {
  square: Square;
  count: number;
  cellSize: number;
  latestCompletionDate: string | undefined;
}) {
```

Replace with:

```tsx
const CELL_PADDING = 10;

/**
 * Small numbered circle used both as a square's corner marker and as each
 * row's number in the "Notes" section below the board. Rendered as a div
 * (not SVG `<text>`, which satori doesn't support) — same technique as
 * `BingoBadge` in src/lib/cards/bingo-mark.tsx.
 */
function FootnoteBadge({ number, diameter }: { number: number; diameter: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: diameter,
        height: diameter,
        borderRadius: "9999px",
        background: SECONDARY,
        border: "2px solid #fff9f0",
        color: "#fff9f0",
        fontSize: diameter * 0.5,
        fontWeight: 700,
        fontFamily: "Fredoka",
      }}
    >
      {number}
    </div>
  );
}

function ExportSquare({
  square,
  count,
  cellSize,
  latestCompletionDate,
  footnoteNumber,
}: {
  square: Square;
  count: number;
  cellSize: number;
  latestCompletionDate: string | undefined;
  footnoteNumber: number | undefined;
}) {
```

- [ ] **Step 4: Render the badge in `ExportSquare`'s root div**

Find the end of `ExportSquare` (the `footerHeight > 0 &&` block's closing, then the component's closing tags):

```tsx
        </div>
      )}
    </div>
  );
}
```

Replace with (this is the *first* occurrence of that exact block, right after the `footerHeight > 0 &&` conditional — the one that closes `ExportSquare`, not the outer `GET` handler):

```tsx
        </div>
      )}
      {footnoteNumber !== undefined && (
        <div style={{ position: "absolute", top: 6, right: 6, display: "flex" }}>
          <FootnoteBadge number={footnoteNumber} diameter={26} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Update the `ExportSquare` call site to pass the new props**

Find:

```tsx
          {slots.map((square, position) =>
            square ? (
              <ExportSquare
                key={square.id}
                square={square}
                count={countsBySquareId[square.id] ?? 0}
                cellSize={cellSize}
                latestCompletionDate={latestCompletionDates[square.id]}
              />
            ) : (
```

Replace with:

```tsx
          {slots.map((square, position) =>
            square ? (
              <ExportSquare
                key={square.id}
                square={square}
                count={countsBySquareId[square.id] ?? 0}
                cellSize={cellSize}
                latestCompletionDate={latestCompletionsBySquareId[square.id]?.completedAt.toISOString()}
                footnoteNumber={footnoteNumbers[square.id]}
              />
            ) : (
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/cards/[id]/export-image/image/route.tsx
git commit -m "feat: compute footnote data and add numbered corner badge to squares with a note or photo

Assisted by Claude."
```

---

### Task 3: "Notes" footnote section + dynamic canvas height

**Files:**
- Modify: `src/app/dashboard/cards/[id]/export-image/image/route.tsx`

- [ ] **Step 1: Add the `ExportFootnotes` component**

Find the end of `ExportSquare` (its closing `}`) followed by the `GET` handler's JSDoc comment:

```tsx
    </div>
  );
}

/**
 * Renders a shareable PNG snapshot of a bingo card: title, board (including
 * each square's completion date where applicable), and a small Bingoal
 * credit + generation date footer — a static image with no interactive
 * chrome (no +/− controls, no tap affordances). See GitHub issue #60.
 */
```

Replace with (inserting `ExportFootnotes` between them, and updating the doc comment):

```tsx
    </div>
  );
}

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

/**
 * Renders a shareable PNG snapshot of a bingo card: title, board (including
 * each square's completion date and, where applicable, a numbered badge
 * pointing at a "Notes" entry with its note text and/or photo), and a small
 * Bingoal credit + generation date footer — a static image with no
 * interactive chrome (no +/− controls, no tap affordances). See GitHub
 * issues #60 and #64.
 */
```

- [ ] **Step 2: Render `ExportFootnotes` and grow the canvas height**

Find the end of the `GET` handler:

```tsx
        <div style={{ display: "flex", marginTop: 5, fontSize: 12, color: MUTED_FOREGROUND }}>Generated on {generatedOn}</div>
      </div>
    </div>,
    { width: CANVAS, height: CANVAS, fonts: await loadCardFonts() },
  );
}
```

Replace with:

```tsx
        <div style={{ display: "flex", marginTop: 5, fontSize: 12, color: MUTED_FOREGROUND }}>Generated on {generatedOn}</div>
      </div>

      <ExportFootnotes entries={footnoteEntries} width={contentWidth} />
    </div>,
    { width: CANVAS, height: CANVAS + footnoteSectionHeight, fonts: await loadCardFonts() },
  );
}
```

- [ ] **Step 3: Typecheck, lint, build**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/cards/[id]/export-image/image/route.tsx
git commit -m "feat: render Notes footnote section and grow canvas height when present

Assisted by Claude."
```

---

### Task 4: Fix `ExportImageViewer`'s fixed-square assumption

**Files:**
- Modify: `src/components/export-image-viewer.tsx`

The export image is no longer always 1080×1080 — a card with footnotes is taller. `ExportImageViewer` currently reserves a fixed `aspect-square` box and stretches the loaded `<img>` to fill it (`h-full w-full`), which would visibly squash a taller image. This task keeps the square placeholder (still correct for the common no-footnote case) but lets the loaded image take its own natural height instead of being stretched.

- [ ] **Step 1: Update the component**

Replace the full contents of `src/components/export-image-viewer.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Displays the export-image PNG on the export-image page. The PNG is
 * generated server-side per request (not cached), so it can take a moment
 * to arrive — without a reserved placeholder the bordered image only
 * appears once loaded, popping into place and shifting the layout around
 * it. This reserves a square footprint up front via `aspect-square` (the
 * PNG is 1080x1080 for cards with no completion notes/photos, the common
 * case) and shows a spinner there while it loads, then swaps in the actual
 * (bordered) image at its own natural size — taller than square for cards
 * whose export includes a "Notes" footnote section (see GitHub issue #64)
 * — rather than stretching it to fill the square placeholder, which would
 * distort it.
 */
export function ExportImageViewer({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full max-w-xl">
      {!loaded && (
        <div className="border-border bg-card flex aspect-square w-full items-center justify-center rounded-[var(--radius-lg)] border-2">
          <Spinner className="text-muted-foreground h-8 w-8" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- this is a
          generated, per-request PNG from our own route handler, not a static
          asset next/image's optimizer would help with. */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={cn(
          // The image's own background is near-black, same as this page's —
          // without a visible border it has no edge to see against the page.
          "border-control-border w-full rounded-[var(--radius-lg)] border-2 shadow-lg transition-opacity duration-300",
          loaded ? "relative h-auto opacity-100" : "absolute inset-0 h-0 opacity-0",
        )}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run the existing tests to confirm they still pass**

Run: `npm test -- export-image-viewer`
Expected: PASS — both existing tests (spinner shown before load, image revealed after load) still pass unchanged, since they only assert the `opacity-0`/`opacity-100` classes and spinner presence.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/export-image-viewer.tsx
git commit -m "fix: stop stretching the export-image preview to a fixed square

Assisted by Claude."
```

---

## Manual verification (after all tasks)

Satori's actual PNG rendering (fonts, `<img>` fetching of signed Storage URLs, real layout) isn't covered by the unit tests above — verify by hand, per GitHub issue #64's "To verify" section:

1. `npm run dev` (or ask before starting a preview server), sign in, open a card.
2. Complete a CHECK square and a COUNTER square, open each one's completion history, and add a note to each. Confirm the exported image (`/dashboard/cards/[id]/export-image`) shows a numbered badge on both squares and a matching "Notes" entry below the board with the note text.
3. Add a photo to one of those completions (via the completion history modal) and re-export — confirm its footnote entry now also shows a thumbnail.
4. Export a card with no notes or photos at all — confirm the image is pixel-layout-identical to before this change (still exactly 1080×1080, no extra spacing).
5. Try a 3×3 and a 5×5 card, each with several long notes (and a couple of photos), and confirm:
   - The board itself never shrinks, overlaps, or overflows regardless of note count.
   - Long notes truncate with an ellipsis rather than overflowing their row.
   - The footnote section's photo thumbnails render correctly.
6. Reload `/dashboard/cards/[id]/export-image` for a footnote-bearing card and confirm the preview page shows the taller image without distortion (not squashed into a square).
