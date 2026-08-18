"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pure-CSS hover tooltip for a single disabled-control use case (no JS
 * state, no positioning library). Hovering anywhere over `children` reveals
 * a small bubble above them via `:hover` cascading to this wrapper — that
 * works even when the wrapped control itself is disabled, since `:hover`
 * applies to ancestors of whatever's under the pointer regardless of the
 * descendant's own pointer-events value.
 *
 * This is a visual affordance only — it doesn't replace `aria-describedby`
 * wiring for screen readers.
 */
export function Tooltip({
  label,
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!label) return <>{children}</>;

  return (
    <span
      className={cn(
        // w-fit: a flex parent's `align-items: stretch` (the default)
        // otherwise stretches this span's width to fill the flex column,
        // regardless of its own `inline-flex` display — which centers the
        // bubble below on the wrong (much wider) box.
        "group relative inline-flex w-fit",
        className,
      )}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          // max-w (not whitespace-nowrap): a long label centered on a narrow
          // mobile square would otherwise force a single-line bubble wide
          // enough to push past the viewport edge, causing horizontal page
          // scroll even though the bubble is invisible until hover.
          "pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[min(80vw,16rem)] -translate-x-1/2 scale-95 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background opacity-0 shadow-lg transition-[opacity,transform] duration-150",
          "group-hover:scale-100 group-hover:opacity-100",
        )}
      >
        {label}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground"
        />
      </span>
    </span>
  );
}
