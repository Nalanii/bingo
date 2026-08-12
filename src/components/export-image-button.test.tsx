// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportImageButton } from "./export-image-button";

/** Builds a fetch mock resolving to a successful PNG response. */
function okPngResponse() {
  return {
    ok: true,
    blob: () => Promise.resolve(new Blob(["fake-png"], { type: "image/png" })),
  } as Response;
}

describe("ExportImageButton", () => {
  const originalFetch = global.fetch;
  const originalClipboard = navigator.clipboard;
  const originalShare = navigator.share;
  const originalCanShare = navigator.canShare;
  const originalClipboardItem = window.ClipboardItem;
  const createObjectURL = vi.fn(() => "blob:mock-url");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(navigator, "clipboard", { value: originalClipboard, configurable: true });
    Object.defineProperty(navigator, "share", { value: originalShare, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: originalCanShare, configurable: true });
    window.ClipboardItem = originalClipboardItem;
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("downloads the PNG when Web Share and clipboard support are both unavailable", async () => {
    global.fetch = vi.fn().mockResolvedValue(okPngResponse());
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    window.ClipboardItem = undefined as unknown as typeof window.ClipboardItem;

    render(<ExportImageButton cardId="card-1" cardName="Weekend Fun!" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Export Weekend Fun! as an image" }));
    });

    expect(global.fetch).toHaveBeenCalledWith("/dashboard/cards/card-1/export-image");
    const downloadButton = await screen.findByRole("menuitem", { name: "Download" });
    expect(screen.queryByRole("menuitem", { name: "Copy" })).not.toBeInTheDocument();

    fireEvent.click(downloadButton);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Downloaded!"));
  });

  it("offers a Copy action and writes the image to the clipboard when supported", async () => {
    global.fetch = vi.fn().mockResolvedValue(okPngResponse());
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { write }, configurable: true });
    window.ClipboardItem = vi.fn() as unknown as typeof window.ClipboardItem;

    render(<ExportImageButton cardId="card-1" cardName="Weekend Fun!" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Export Weekend Fun! as an image" }));
    });

    const copyButton = await screen.findByRole("menuitem", { name: "Copy" });
    fireEvent.click(copyButton);

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copied!"));
  });

  it("shows an inline error when the fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });

    render(<ExportImageButton cardId="card-1" cardName="Weekend Fun!" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Export Weekend Fun! as an image" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't create the image. Please try again.",
    );
  });

  it("shows the error text returned by a non-200 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("You need to sign in to do that."),
    } as Response);
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });

    render(<ExportImageButton cardId="card-1" cardName="Weekend Fun!" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Export Weekend Fun! as an image" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("You need to sign in to do that.");
  });

  it("uses the native share sheet when full Web Share file support is available", async () => {
    global.fetch = vi.fn().mockResolvedValue(okPngResponse());
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: canShare, configurable: true });

    render(<ExportImageButton cardId="card-1" cardName="Weekend Fun!" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Export Weekend Fun! as an image" }));
    });

    expect(share).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
