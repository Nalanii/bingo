"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
  "aria-describedby"?: string;
  className?: string;
  disabled?: boolean;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  disabled = false,
  ...props
}: SegmentedControlProps) {
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (disabled) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + options.length) % options.length;
    onChange(options[nextIndex].value);
    // Move focus with the selection, or the next arrow press fires on the
    // now-stale button and recomputes from its (unchanged) index forever.
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"]}
      aria-describedby={props["aria-describedby"]}
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex rounded-full border-2 border-border bg-muted p-1",
        disabled && "opacity-50",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => !disabled && onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
