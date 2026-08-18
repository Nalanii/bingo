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
