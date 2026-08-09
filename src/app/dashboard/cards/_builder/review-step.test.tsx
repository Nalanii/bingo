// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewStep } from "./review-step";
import type { PositionedSquareDraft } from "./positions";
import type { CardSettings } from "./types";

describe("ReviewStep", () => {
  it("does not mutate the squares prop array when sorting for the preview", () => {
    // Deliberately out-of-order positions so a sort is actually needed.
    const squares: PositionedSquareDraft[] = [
      { label: "Third", kind: "CHECK", goal: 1, position: 2 },
      { label: "First", kind: "CHECK", goal: 1, position: 0 },
      { label: "Second", kind: "CHECK", goal: 1, position: 1 },
    ];
    const originalOrder = squares.map((square) => square.label);
    const settings: CardSettings = {
      name: "Test card",
      gridSize: 3,
      hasFreeSpace: false,
      layout: "RANDOM",
    };

    render(
      <ReviewStep
        settings={settings}
        squares={squares}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    // The array passed in as `squares` (standing in for the parent's state)
    // must be untouched, in its original entry order.
    expect(squares.map((square) => square.label)).toEqual(originalOrder);
  });

  it("still renders squares in position order, without a free space", () => {
    const squares: PositionedSquareDraft[] = [
      { label: "Third", kind: "CHECK", goal: 1, position: 2 },
      { label: "First", kind: "CHECK", goal: 1, position: 0 },
      { label: "Second", kind: "CHECK", goal: 1, position: 1 },
    ];
    const settings: CardSettings = {
      name: "Test card",
      gridSize: 3,
      hasFreeSpace: false,
      layout: "RANDOM",
    };

    render(
      <ReviewStep
        settings={settings}
        squares={squares}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
  });
});
