"use client";

import { useCallback, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Displays the export-image PNG on the export-image page, along with an
 * "Include notes & photos" toggle (GitHub issue #66) that controls whether
 * the generated image includes the "Notes" footnote section (see #64). The
 * PNG is generated server-side per request (not cached), so it can take a
 * moment to arrive — without a reserved placeholder the bordered image only
 * appears once loaded, popping into place and shifting the layout around
 * it. This reserves a square footprint up front via `aspect-square` (the
 * PNG is 1080x1080 whenever the footnote section is omitted — either by
 * toggle or because the card has no qualifying notes/photos) and shows a
 * spinner there while it loads, then swaps in the actual (bordered) image
 * at its own natural size — taller than square when the footnote section
 * is included — rather than stretching it to fill the square placeholder,
 * which would distort it.
 */
export function ExportImageViewer({ src, alt }: { src: string; alt: string }) {
  // Defaults to on so existing sharing behavior is unchanged for anyone who
  // never touches the toggle.
  const [includeNotes, setIncludeNotes] = useState(true);
  const imageSrc = includeNotes ? src : `${src}?notes=0`;

  // Tracks which src has actually finished loading, rather than a plain
  // loaded boolean — `loaded` is then derived by comparing it to the
  // current `imageSrc` below. That makes toggling the switch (which swaps
  // the same <img> element's src without remounting it) automatically
  // re-show the spinner for the new, still-loading image with no separate
  // effect needed to reset anything.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === imageSrc;

  // Callback ref instead of onLoad alone: onLoad only fires for the `load`
  // event, which can happen before React attaches the listener (e.g. an
  // image resolved from the browser cache, or just very fast) — in that
  // case `load` never fires again and the spinner would spin forever even
  // though the image already finished. Checking `img.complete` as soon as
  // the ref attaches catches that case; onLoad still covers the normal
  // (slower, uncached) path, including every subsequent src swap from
  // toggling the switch — by then the listener is already attached, so
  // there's no race to guard against.
  const imgRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete) setLoadedSrc(imageSrc);
    },
    [imageSrc],
  );

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4">
      <div className="border-border bg-card flex w-full items-center justify-between gap-4 rounded-[var(--radius-lg)] border-2 px-4 py-3">
        <label htmlFor="export-include-notes" className="text-sm font-semibold">
          Include notes &amp; photos
        </label>
        <Switch id="export-include-notes" checked={includeNotes} onChange={setIncludeNotes} aria-label="Include notes & photos" />
      </div>

      <div className="relative w-full">
        {!loaded && (
          <div className="border-border bg-card flex aspect-square w-full items-center justify-center rounded-[var(--radius-lg)] border-2">
            <Spinner className="text-muted-foreground h-8 w-8" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- this is a
            generated, per-request PNG from our own route handler, not a static
            asset next/image's optimizer would help with. */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          onLoad={() => setLoadedSrc(imageSrc)}
          className={cn(
            // The image's own background is near-black, same as this page's —
            // without a visible border it has no edge to see against the page.
            "border-control-border w-full rounded-[var(--radius-lg)] border-2 shadow-lg transition-opacity duration-300",
            loaded ? "relative h-auto opacity-100" : "absolute inset-0 h-0 opacity-0",
          )}
        />
      </div>
    </div>
  );
}
