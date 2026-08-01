// src/app/design-tokens.contrast.test.ts
//
// Hardcoded literal hex values — keep these in sync with src/app/globals.css
// by hand. This is the regression guard for every color-contrast fix in the
// WCAG 2.1 AA pass: if a future edit to globals.css breaks a ratio, this
// test catches it.
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../lib/color-contrast";

const LIGHT = {
  background: "#fff9f0",
  card: "#ffffff",
  primary: "#e60053",
  primaryForeground: "#ffffff",
  destructive: "#e2243d",
  destructiveForeground: "#ffffff",
  controlBorder: "#a57acf",
};

const DARK = {
  background: "#171325",
  card: "#211b33",
  controlBorder: "#7662a7",
};

describe("design token contrast (light mode)", () => {
  it("primary bg vs primary-foreground text meets 4.5:1", () => {
    expect(contrastRatio(LIGHT.primary, LIGHT.primaryForeground)).toBeGreaterThanOrEqual(4.5);
  });

  it("destructive bg vs destructive-foreground text meets 4.5:1", () => {
    expect(contrastRatio(LIGHT.destructive, LIGHT.destructiveForeground)).toBeGreaterThanOrEqual(4.5);
  });

  it("control-border meets 3:1 against both background and card", () => {
    expect(contrastRatio(LIGHT.controlBorder, LIGHT.background)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(LIGHT.controlBorder, LIGHT.card)).toBeGreaterThanOrEqual(3.0);
  });
});

describe("design token contrast (dark mode)", () => {
  it("control-border meets 3:1 against both background and card", () => {
    expect(contrastRatio(DARK.controlBorder, DARK.background)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(DARK.controlBorder, DARK.card)).toBeGreaterThanOrEqual(3.0);
  });
});
