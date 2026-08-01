// src/app/design-tokens.contrast.test.ts
//
// Reads the actual custom-property values out of src/app/globals.css at test
// time (rather than duplicating hex constants by hand) — the regression guard
// for every color-contrast fix in the WCAG 2.1 AA pass: if a future edit to
// globals.css breaks a ratio, this test catches it against the real file.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../lib/color-contrast";

const CSS_PATH = fileURLToPath(new URL("./globals.css", import.meta.url));
const css = readFileSync(CSS_PATH, "utf-8");

/** Extracts `--token: #hexvalue;` custom-property declarations from a block of CSS text. */
function extractTokens(cssBlock: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const pattern = /--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cssBlock))) {
    tokens[match[1]] = match[2].toLowerCase();
  }
  return tokens;
}

/** Returns the content between the first `{` after `startMarker` and its matching closing `}`. */
function extractBlock(source: string, startMarker: RegExp): string {
  const startMatch = startMarker.exec(source);
  if (!startMatch) {
    throw new Error(`Could not find block matching ${startMarker} in globals.css`);
  }
  const openBraceIndex = source.indexOf("{", startMatch.index);
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(openBraceIndex + 1, i);
    }
  }
  throw new Error(`Unterminated block matching ${startMarker} in globals.css`);
}

// The light-mode `:root { ... }` block is the first `:root` in the file;
// the dark-mode block is the `:root { ... }` nested inside
// `@media (prefers-color-scheme: dark) { ... }`.
const rootBlock = extractBlock(css, /:root\s*\{/);
const darkMediaBlock = extractBlock(css, /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/);
const darkRootBlock = extractBlock(darkMediaBlock, /:root\s*\{/);

const LIGHT = extractTokens(rootBlock);
const DARK = extractTokens(darkRootBlock);

describe("design token contrast (light mode)", () => {
  it("primary bg vs primary-foreground text meets 4.5:1", () => {
    expect(contrastRatio(LIGHT.primary, LIGHT["primary-foreground"])).toBeGreaterThanOrEqual(4.5);
  });

  it("destructive bg vs destructive-foreground text meets 4.5:1", () => {
    expect(
      contrastRatio(LIGHT.destructive, LIGHT["destructive-foreground"]),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("control-border meets 3:1 against both background and card", () => {
    expect(contrastRatio(LIGHT["control-border"], LIGHT.background)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(LIGHT["control-border"], LIGHT.card)).toBeGreaterThanOrEqual(3.0);
  });

  it("wordmark on-surface text tokens meet 4.5:1 against background", () => {
    expect(
      contrastRatio(LIGHT["primary-on-surface"], LIGHT.background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(LIGHT["success-on-surface"], LIGHT.background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(LIGHT["accent-on-surface"], LIGHT.background),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("ring meets 3:1 against background", () => {
    expect(contrastRatio(LIGHT.ring, LIGHT.background)).toBeGreaterThanOrEqual(3.0);
  });
});

describe("design token contrast (dark mode)", () => {
  it("control-border meets 3:1 against both background and card", () => {
    expect(contrastRatio(DARK["control-border"], DARK.background)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(DARK["control-border"], DARK.card)).toBeGreaterThanOrEqual(3.0);
  });

  it("ring meets 3:1 against background", () => {
    expect(contrastRatio(DARK.ring, DARK.background)).toBeGreaterThanOrEqual(3.0);
  });

  it("wordmark on-surface text tokens meet 4.5:1 against background", () => {
    expect(contrastRatio(DARK["primary-on-surface"], DARK.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK["success-on-surface"], DARK.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK["accent-on-surface"], DARK.background)).toBeGreaterThanOrEqual(4.5);
  });
});
