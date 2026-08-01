import { describe, expect, it } from "vitest";
import { describeLine, buildLineSrText } from "./celebration-text";

describe("describeLine", () => {
  it("describes a row", () => {
    expect(describeLine({ type: "row", index: 1 })).toBe("row 2");
  });

  it("describes a column", () => {
    expect(describeLine({ type: "column", index: 0 })).toBe("column 1");
  });

  it("describes the main diagonal", () => {
    expect(describeLine({ type: "diagonal", index: 0 })).toBe(
      "the top-left to bottom-right diagonal",
    );
  });

  it("describes the anti-diagonal", () => {
    expect(describeLine({ type: "diagonal", index: 1 })).toBe(
      "the top-right to bottom-left diagonal",
    );
  });
});

describe("buildLineSrText", () => {
  it("uses the provided fallback with no lines", () => {
    expect(buildLineSrText([], "Bingo! You completed a line.")).toBe(
      "Bingo! You completed a line.",
    );
  });

  it("names a single completed line, ignoring the fallback", () => {
    expect(buildLineSrText([{ type: "row", index: 1 }], "fallback")).toBe(
      "Bingo! You completed row 2.",
    );
  });

  it("names every line when multiple complete at once", () => {
    expect(
      buildLineSrText(
        [
          { type: "row", index: 1 },
          { type: "column", index: 0 },
        ],
        "fallback",
      ),
    ).toBe("Bingo! You completed 2 lines: row 2, column 1.");
  });
});
