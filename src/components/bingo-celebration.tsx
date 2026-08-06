"use client";

import { useEffect, useState } from "react";
import type { BingoLine } from "@/lib/cards/progress";
import { buildLineSrText } from "@/lib/cards/celebration-text";
import { cn } from "@/lib/utils";

const CONFETTI_COLORS = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-accent)",
  "var(--color-success)",
];

export type BingoCelebrationVariant = "line" | "blackout";

export interface BingoCelebrationProps {
  variant?: BingoCelebrationVariant;
  lines?: BingoLine[];
}

interface CelebrationConfig {
  confettiCount: number;
  visibleDurationMs: number;
  badgeText: string;
  srText: string;
}

const CELEBRATION_CONFIG: Record<BingoCelebrationVariant, CelebrationConfig> = {
  line: {
    confettiCount: 24,
    visibleDurationMs: 1500,
    badgeText: "Bingo!",
    srText: "Bingo! You completed a line.",
  },
  blackout: {
    confettiCount: 48,
    visibleDurationMs: 2500,
    badgeText: "Blackout!",
    srText: "Blackout! You completed the whole card.",
  },
};

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  rotation: number;
  color: string;
}

function createConfettiPieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 1 + Math.random() * 0.6,
    rotation: Math.random() * 360,
    color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
  }));
}

/**
 * One-shot confetti burst + "BINGO!" badge. Mount with a fresh `key` (e.g.
 * an incrementing trigger counter) each time a new line completes so this
 * remounts and re-animates instead of reusing a cleared-out instance.
 *
 * The `variant` prop ("line" | "blackout", defaults to "line") controls the
 * confetti count, visible duration, and badge/screen-reader text.
 */
export function BingoCelebration({ variant = "line", lines }: BingoCelebrationProps) {
  const config = CELEBRATION_CONFIG[variant];
  const [pieces] = useState(() => createConfettiPieces(config.confettiCount));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), config.visibleDurationMs);
    return () => clearTimeout(timer);
  }, [config.visibleDurationMs]);

  if (!visible) return null;

  const srText = variant === "blackout" ? config.srText : buildLineSrText(lines ?? [], config.srText);
  const isBlackout = variant === "blackout";

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {isBlackout && (
          <div
            className="absolute inset-0 bg-gradient-to-br from-accent/40 via-primary/25 to-transparent"
            style={{ animation: "blackout-flash 0.8s ease-out forwards" }}
          />
        )}
        {pieces.map((piece) => (
          <span
            key={piece.id}
            className={cn("absolute top-0 rounded-sm", isBlackout ? "h-3 w-3" : "h-2.5 w-2.5")}
            style={{
              left: `${piece.left}%`,
              backgroundColor: piece.color,
              transform: `rotate(${piece.rotation}deg)`,
              animation: `confetti-fall ${piece.duration}s ease-in ${piece.delay}s forwards`,
            }}
          />
        ))}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2">
          <span
            className={cn(
              "font-display inline-block rounded-[var(--radius-sm)] border-2 font-bold tracking-wide uppercase shadow-lg",
              isBlackout
                ? "border-primary bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%] px-6 py-3 text-2xl text-primary-foreground"
                : "border-accent bg-accent text-accent-foreground px-4 py-2 text-lg",
            )}
            style={{
              animation: isBlackout
                ? "wobble 0.4s ease-in-out 2, blackout-shimmer 1.2s linear 2"
                : "wobble 0.4s ease-in-out 2",
            }}
          >
            {config.badgeText}
          </span>
        </div>
      </div>
      <p role="status" className="sr-only">
        {srText}
      </p>
    </>
  );
}
