// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays onCancel until the exit animation finishes, flagging data-state in the meantime", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        ariaLabel="Discard changes?"
        message="Discard unsaved changes?"
        confirmLabel="Discard"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveAttribute("data-state", "closing");

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("delays onConfirm until the exit animation finishes", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        ariaLabel="Discard changes?"
        message="Discard unsaved changes?"
        confirmLabel="Discard"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    });

    expect(onConfirm).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
