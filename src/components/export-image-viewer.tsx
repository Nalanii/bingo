"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Displays the export-image PNG on the export-image page. The PNG is
 * generated server-side per request (not cached), so it can take a moment
 * to arrive — without a reserved placeholder the bordered image only
 * appears once loaded, popping into place and shifting the layout around
 * it. This reserves a square footprint up front via `aspect-square` (the
 * PNG is 1080x1080 for cards with no completion notes/photos, the common
 * case) and shows a spinner there while it loads, then swaps in the actual
 * (bordered) image at its own natural size — taller than square for cards
 * whose export includes a "Notes" footnote section (see GitHub issue #64)
 * — rather than stretching it to fill the square placeholder, which would
 * distort it.
 */
export function ExportImageViewer({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full max-w-xl">
      {!loaded && (
        <div className="border-border bg-card flex aspect-square w-full items-center justify-center rounded-[var(--radius-lg)] border-2">
          <Spinner className="text-muted-foreground h-8 w-8" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- this is a
          generated, per-request PNG from our own route handler, not a static
          asset next/image's optimizer would help with. */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={cn(
          // The image's own background is near-black, same as this page's —
          // without a visible border it has no edge to see against the page.
          "border-control-border w-full rounded-[var(--radius-lg)] border-2 shadow-lg transition-opacity duration-300",
          loaded ? "relative h-auto opacity-100" : "absolute inset-0 h-0 opacity-0",
        )}
      />
    </div>
  );
}
