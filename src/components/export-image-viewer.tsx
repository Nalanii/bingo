"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Displays the export-image PNG on the export-image page. The PNG is
 * generated server-side per request (not cached), so it can take a moment
 * to arrive — without a reserved, correctly-sized placeholder the bordered
 * image only appears once loaded, popping into place and shifting the
 * layout around it. This reserves the image's final square footprint (the
 * PNG is always 1080x1080) up front via `aspect-square`, shows a spinner
 * there while it loads, then fades the actual (bordered) image in.
 */
export function ExportImageViewer({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative aspect-square w-full max-w-xl">
      {!loaded && (
        <div className="border-border bg-card absolute inset-0 flex items-center justify-center rounded-[var(--radius-lg)] border-2">
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
          "border-control-border absolute inset-0 h-full w-full rounded-[var(--radius-lg)] border-2 shadow-lg transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
