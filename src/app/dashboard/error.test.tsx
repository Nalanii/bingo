// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";
import DashboardError from "./error";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: import("react").ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("DashboardError", () => {
  it("shows generic copy, never the raw error message", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/cards/new");
    render(
      <DashboardError
        error={new Error("permission-denied: missing composite index")}
        reset={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We hit a snag loading this page. Give it another try.",
    );
    expect(screen.queryByText(/permission-denied/)).not.toBeInTheDocument();
  });

  it("calls reset() when Try again is clicked", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/cards/new");
    const reset = vi.fn();
    render(<DashboardError error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("shows a link back to the dashboard when not already there", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/cards/new");
    render(<DashboardError error={new Error("boom")} reset={vi.fn()} />);

    const link = screen.getByRole("link", { name: "Back to your cards" });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("hides the back-to-dashboard link when already on the dashboard", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    render(<DashboardError error={new Error("boom")} reset={vi.fn()} />);

    expect(
      screen.queryByRole("link", { name: "Back to your cards" }),
    ).not.toBeInTheDocument();
  });
});
