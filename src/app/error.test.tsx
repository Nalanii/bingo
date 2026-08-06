// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { useRouter } from "next/navigation";
import RootError from "./error";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: import("react").ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("RootError", () => {
  vi.mocked(useRouter).mockReturnValue({
    refresh: mockRefresh,
  } as unknown as ReturnType<typeof useRouter>);

  afterEach(() => {
    mockRefresh.mockClear();
  });

  it("shows generic copy, never the raw error message", () => {
    render(
      <RootError error={new Error("permission-denied: missing composite index")} reset={vi.fn()} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We hit a snag loading this page. Give it another try.",
    );
    expect(screen.queryByText(/permission-denied/)).not.toBeInTheDocument();
  });

  it("logs the raw error to the console instead of rendering it", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("permission-denied: missing composite index");
    render(<RootError error={error} reset={vi.fn()} />);

    expect(consoleError).toHaveBeenCalledWith("Root error boundary caught:", error);
    consoleError.mockRestore();
  });

  it("hides the decorative emoji from screen readers", () => {
    render(<RootError error={new Error("boom")} reset={vi.fn()} />);

    expect(screen.getByText("😵")).toHaveAttribute("aria-hidden", "true");
  });

  it("refreshes the router and calls reset() when Try again is clicked", () => {
    const reset = vi.fn();
    render(<RootError error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("links back to the homepage", () => {
    render(<RootError error={new Error("boom")} reset={vi.fn()} />);

    const link = screen.getByRole("link", { name: "Go back home" });
    expect(link).toHaveAttribute("href", "/");
  });
});
