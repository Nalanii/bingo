// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExportImageViewer } from "./export-image-viewer";

describe("ExportImageViewer", () => {
  it("shows a spinner and a hidden image before the image loads", () => {
    render(<ExportImageViewer src="/some/export-image" alt="Weekend Fun! bingo card" />);

    expect(screen.getByRole("img", { name: "Weekend Fun! bingo card" })).toHaveClass("opacity-0");
    // The Spinner component hides itself from assistive tech (aria-hidden),
    // so it's not queryable by role — its presence is asserted via the
    // placeholder container that wraps it instead.
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("reveals the image and hides the spinner once the image loads", () => {
    render(<ExportImageViewer src="/some/export-image" alt="Weekend Fun! bingo card" />);

    fireEvent.load(screen.getByRole("img", { name: "Weekend Fun! bingo card" }));

    expect(screen.getByRole("img", { name: "Weekend Fun! bingo card" })).toHaveClass("opacity-100");
    expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("defaults the 'Include notes & photos' toggle on and points the image at the plain src", () => {
    render(<ExportImageViewer src="/some/export-image" alt="Weekend Fun! bingo card" />);

    expect(screen.getByRole("switch", { name: "Include notes & photos" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("img", { name: "Weekend Fun! bingo card" })).toHaveAttribute("src", "/some/export-image");
  });

  it("switches the image to ?notes=0 and re-shows the spinner when the toggle is turned off", () => {
    render(<ExportImageViewer src="/some/export-image" alt="Weekend Fun! bingo card" />);

    fireEvent.load(screen.getByRole("img", { name: "Weekend Fun! bingo card" }));
    fireEvent.click(screen.getByRole("switch", { name: "Include notes & photos" }));

    expect(screen.getByRole("switch", { name: "Include notes & photos" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("img", { name: "Weekend Fun! bingo card" })).toHaveAttribute("src", "/some/export-image?notes=0");
    expect(screen.getByRole("img", { name: "Weekend Fun! bingo card" })).toHaveClass("opacity-0");
  });
});
