// src/lib/use-dialog-a11y.test.tsx
// @vitest-environment jsdom
import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDialogA11y } from "./use-dialog-a11y";

function Harness({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(ref, onClose);
  return (
    <div ref={ref} role="dialog" aria-label="Test dialog" tabIndex={-1}>
      <button type="button">First</button>
      <button type="button">Last</button>
    </div>
  );
}

function TestApp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div>
      <button type="button">Outside trigger</button>
      {open && <Harness onClose={onClose} />}
    </div>
  );
}

describe("useDialogA11y", () => {
  it("moves focus to the first focusable element inside the dialog on mount", () => {
    render(<Harness onClose={vi.fn()} />);
    expect(screen.getByText("First")).toHaveFocus();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps Tab from the last focusable element back to the first", () => {
    render(<Harness onClose={vi.fn()} />);
    screen.getByText("Last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByText("First")).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element to the last", () => {
    render(<Harness onClose={vi.fn()} />);
    expect(screen.getByText("First")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByText("Last")).toHaveFocus();
  });

  it("returns focus to the previously-focused element when the dialog unmounts", () => {
    const { rerender } = render(<TestApp open={false} onClose={vi.fn()} />);
    const trigger = screen.getByText("Outside trigger");
    trigger.focus();
    expect(trigger).toHaveFocus();

    rerender(<TestApp open={true} onClose={vi.fn()} />);
    expect(screen.getByText("First")).toHaveFocus();

    rerender(<TestApp open={false} onClose={vi.fn()} />);
    expect(trigger).toHaveFocus();
  });
});
