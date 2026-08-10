// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";
import { PageTransition } from "./page-transition";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

describe("PageTransition", () => {
  it("renders its children", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    render(
      <PageTransition>
        <p>Hello</p>
      </PageTransition>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("remounts its wrapper when the pathname changes, so the entrance animation replays", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    const { container, rerender } = render(
      <PageTransition>
        <p>Hello</p>
      </PageTransition>,
    );
    const firstWrapper = container.firstElementChild;

    vi.mocked(usePathname).mockReturnValue("/dashboard/cards/new");
    rerender(
      <PageTransition>
        <p>Hello</p>
      </PageTransition>,
    );

    expect(container.firstElementChild).not.toBe(firstWrapper);
  });
});
