"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Copy, Download, ImageDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { Tooltip } from "@/components/ui/tooltip";

interface ExportImageButtonProps {
  cardId: string;
  cardName: string;
}

const ICON_BUTTON_CLASS =
  "shrink-0 rounded-[var(--radius-sm)] p-1 text-muted-foreground transition-colors hover:text-foreground";

/** Lowercases, replaces whitespace runs with a hyphen, and strips anything that isn't alphanumeric or a hyphen — keeps filenames simple and safe across OSes. */
function sanitizeForFilename(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || "bingo-card"
  );
}

/** Detects "real" file-sharing support for the Web Share API — both `navigator.share` and `navigator.canShare` must exist, and `canShare` must actually accept a file, since support for sharing files (as opposed to just text/links) is inconsistent across browsers. */
function canShareFile(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

/** Detects support for writing an image to the system clipboard — older browsers lack `ClipboardItem` entirely even when `navigator.clipboard` exists. */
function canCopyImages(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === "function" &&
    typeof window !== "undefined" &&
    typeof window.ClipboardItem === "function"
  );
}

/**
 * Header icon button that fetches a shareable PNG snapshot of the card
 * (rendered server-side by the export-image route handler) and lets the
 * user get it out of the browser: the native share sheet where supported
 * (best mobile UX — bundles save/copy/send-to-app in one place), otherwise
 * a small popover offering an explicit download and, where available, a
 * copy-to-clipboard action. See GitHub issue #60.
 */
export function ExportImageButton({ cardId, cardName }: ExportImageButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [menuBlob, setMenuBlob] = useState<Blob | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const statusId = useId();

  const closeMenu = () => setMenuBlob(null);
  useDialogA11y(popoverRef, closeMenu);

  // Dismiss the popover on an outside click (Escape/focus-trap are handled
  // by useDialogA11y above).
  useEffect(() => {
    if (!menuBlob) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeMenu();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuBlob]);

  async function handleClick() {
    if (pending) return;
    setError(null);
    setStatus(null);
    setPending(true);
    try {
      const response = await fetch(`/dashboard/cards/${cardId}/export-image`);
      if (!response.ok) {
        const message = await response.text().catch(() => "");
        setError(message || "Couldn't create the image. Please try again.");
        return;
      }
      const blob = await response.blob();
      const file = new File([blob], `${sanitizeForFilename(cardName)}-bingo.png`, {
        type: "image/png",
      });

      if (canShareFile(file)) {
        try {
          await navigator.share({ files: [file], title: cardName });
          setStatus("Shared!");
        } catch (shareError) {
          // AbortError means the user just dismissed the share sheet — not a failure worth reporting.
          if (shareError instanceof Error && shareError.name === "AbortError") return;
          setError("Couldn't share the image. Please try again.");
        }
        return;
      }

      // No (full) Web Share support — offer explicit download/copy actions instead.
      setMenuBlob(blob);
    } catch {
      setError("Couldn't create the image. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function handleDownload() {
    if (!menuBlob) return;
    const url = URL.createObjectURL(menuBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeForFilename(cardName)}-bingo.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus("Downloaded!");
    closeMenu();
  }

  async function handleCopy() {
    if (!menuBlob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": menuBlob })]);
      setStatus("Copied!");
      closeMenu();
    } catch {
      setError("Couldn't copy the image. Please try downloading it instead.");
    }
  }

  return (
    <div className="relative shrink-0">
      <Tooltip label="Export image">
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Export ${cardName} as an image`}
          aria-busy={pending}
          disabled={pending}
          className={cn(ICON_BUTTON_CLASS, "disabled:cursor-wait disabled:opacity-60")}
          onClick={handleClick}
        >
          <ImageDown aria-hidden="true" className="size-5" />
        </button>
      </Tooltip>

      {menuBlob && (
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Export options"
          tabIndex={-1}
          className="border-border bg-card text-card-foreground absolute top-full right-0 z-10 mt-2 flex w-40 flex-col gap-1 rounded-[var(--radius-sm)] border-2 p-1.5 shadow-lg focus-visible:outline-none"
        >
          <button
            type="button"
            role="menuitem"
            className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted"
            onClick={handleDownload}
          >
            <Download aria-hidden="true" className="size-4" />
            Download
          </button>
          {canCopyImages() && (
            <button
              type="button"
              role="menuitem"
              className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted"
              onClick={handleCopy}
            >
              <Copy aria-hidden="true" className="size-4" />
              Copy
            </button>
          )}
        </div>
      )}

      <p aria-live="polite" id={statusId} className="sr-only" role="status">
        {status}
      </p>
      {error && (
        <p role="alert" className="text-destructive absolute top-full right-0 mt-2 w-48 text-right text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
