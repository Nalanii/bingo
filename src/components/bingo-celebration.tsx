"use client";

import { useEffect, useState } from "react";

const CONFETTI_COLORS = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-accent)",
  "var(--color-success)",
];

export type BingoCelebrationVariant = "line" | "blackout";

export interface BingoCelebrationProps {
  variant?: BingoCelebrationVariant;
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
export function BingoCelebration({ variant = "line" }: BingoCelebrationProps) {
  const config = CELEBRATION_CONFIG[variant];
  const [pieces] = useState(() => createConfettiPieces(config.confettiCount));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), config.visibleDurationMs);
    return () => clearTimeout(timer);
  }, [config.visibleDurationMs]);

  if (!visible) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 h-2.5 w-2.5 rounded-sm"
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
          className="font-display border-accent bg-accent text-accent-foreground inline-block rounded-[var(--radius-sm)] border-2 px-4 py-2 text-lg font-bold tracking-wide uppercase shadow-lg"
          style={{ animation: "wobble 0.4s ease-in-out 2" }}
        >
          {config.badgeText}
        </span>
      </div>
      <p role="status" className="sr-only">
        {config.srText}
      </p>
    </div>
  );
}
