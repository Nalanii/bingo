// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BingoCelebration } from "./bingo-celebration";

describe("BingoCelebration", () => {
  it("renders its screen-reader announcement outside any aria-hidden subtree", () => {
    render(<BingoCelebration lines={[{ type: "row", index: 1 }]} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Bingo! You completed row 2.");

    // A role="status" element inside an aria-hidden ancestor is removed from
    // the accessibility tree and never announced — walk up and confirm none
    // of its ancestors are aria-hidden.
    let node: HTMLElement | null = status;
    while (node) {
      expect(node.getAttribute("aria-hidden")).not.toBe("true");
      node = node.parentElement;
    }
  });

  it("falls back to the generic message for the blackout variant", () => {
    render(<BingoCelebration variant="blackout" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Blackout! You completed the whole card.",
    );
  });
});
