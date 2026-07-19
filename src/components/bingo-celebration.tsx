"use client";

import { useEffect, useState } from "react";

const CONFETTI_COLORS = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-accent)",
  "var(--color-success)",
];
const CONFETTI_COUNT = 24;
const VISIBLE_DURATION_MS = 1500;

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  rotation: number;
  color: string;
}

function createConfettiPieces(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, id) => ({
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
 */
export function BingoCelebration() {
  const [pieces] = useState(createConfettiPieces);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), VISIBLE_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

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
          Bingo!
        </span>
      </div>
      <p role="status" className="sr-only">
        Bingo! You completed a line.
      </p>
    </div>
  );
}
