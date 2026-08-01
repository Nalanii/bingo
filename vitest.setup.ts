import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest doesn't expose test globals (e.g. `afterEach`) by default the way
// Jest does, so React Testing Library's built-in auto-cleanup — which only
// registers itself when it detects a global `afterEach` — never fires here.
// Without this, unmounted components from earlier tests in the same file
// stay in the document, causing duplicate-element failures in later tests.
afterEach(() => {
  cleanup();
});
