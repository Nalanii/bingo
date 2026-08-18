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
