import { describe, expect, it } from "vitest";
import { contrastRatio, mixColors } from "./color-contrast";

describe("contrastRatio", () => {
  it("returns 21:1 for pure black on pure white (the maximum possible ratio)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("returns 1:1 for a color against itself", () => {
    expect(contrastRatio("#7c4dff", "#7c4dff")).toBeCloseTo(1, 5);
  });

  it("is order-independent", () => {
    const a = contrastRatio("#ff4d8d", "#ffffff");
    const b = contrastRatio("#ffffff", "#ff4d8d");
    expect(a).toBeCloseTo(b, 10);
  });

  it("matches the published WCAG example: #767676 on white is ~4.54:1 (the classic 'just passes AA' gray)", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
  });

  it("matches this app's known-failing pair: --primary bg vs white text is ~3.14:1", () => {
    expect(contrastRatio("#ff4d8d", "#ffffff")).toBeCloseTo(3.14, 1);
  });

  it("matches this app's known-passing pair: --secondary bg vs white text is ~4.81:1", () => {
    expect(contrastRatio("#7c4dff", "#ffffff")).toBeCloseTo(4.81, 1);
  });
});

describe("mixColors", () => {
  it("returns the foreground color untouched at full alpha", () => {
    expect(mixColors("#ffffff", "#000000", 1)).toBe("#ffffff");
  });

  it("returns the background color untouched at zero alpha", () => {
    expect(mixColors("#ffffff", "#000000", 0)).toBe("#000000");
  });

  it("matches a hand-computed blend: primary at 10% over this app's light background", () => {
    // --primary (#e60053) at 10% alpha over --background (#fff9f0), light mode.
    expect(mixColors("#e60053", "#fff9f0", 0.1)).toBe("#fde0e0");
  });

  it("matches a hand-computed blend: primary at 10% over this app's dark background", () => {
    // --primary (#ff6aa2) at 10% alpha over --background (#171325), dark mode.
    expect(mixColors("#ff6aa2", "#171325", 0.1)).toBe("#2e1c32");
  });
});
