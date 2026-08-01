import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color-contrast";

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
