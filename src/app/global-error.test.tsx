// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

describe("GlobalError", () => {
  it("shows generic copy, never the raw error message", () => {
    render(
      <GlobalError
        error={new Error("permission-denied: missing composite index")}
        reset={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The app hit a snag. Try reloading the page.");
    expect(screen.queryByText(/permission-denied/)).not.toBeInTheDocument();
  });

  it("logs the raw error to the console instead of rendering it", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("permission-denied: missing composite index");
    render(<GlobalError error={error} reset={vi.fn()} />);

    expect(consoleError).toHaveBeenCalledWith("Global error boundary caught:", error);
    consoleError.mockRestore();
  });

  it("hides the decorative emoji from screen readers", () => {
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);

    expect(screen.getByText("😵")).toHaveAttribute("aria-hidden", "true");
  });

  it("links back to the homepage", () => {
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);

    const link = screen.getByRole("link", { name: "Go back home" });
    expect(link).toHaveAttribute("href", "/");
  });
});
