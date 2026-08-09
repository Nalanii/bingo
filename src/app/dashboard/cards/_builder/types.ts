import type { SquareKind } from "@/lib/firestore/cards";

export type CardSettings = {
  name: string;
  gridSize: 3 | 5;
  hasFreeSpace: boolean;
  layout: "RANDOM" | "SET";
};

export type SquareDraft = {
  label: string;
  kind: SquareKind;
  goal: number;
};

// Success is expressed by `redirect()` throwing, not by a return value — the
// success arm here only ever completes via `void` when a caller doesn't
// redirect (there currently is none, but the type stays honest about it).
export type SaveCardResult = { ok: false; error: string } | void;

/**
 * Validates a square's kind/goal pairing, shared between the create and
 * update server actions so the rule only has to change in one place.
 * Returns an error message, or null if the pairing is valid.
 */
export function validateSquareKindAndGoal(square: { kind: SquareKind; goal: number }): string | null {
  if (square.kind !== "CHECK" && square.kind !== "COUNTER") {
    return "Invalid square type.";
  }
  if (square.kind === "CHECK" && square.goal !== 1) {
    return "Check squares must have a goal of 1.";
  }
  if (square.kind === "COUNTER" && (!Number.isInteger(square.goal) || square.goal < 2)) {
    return "Counter squares need a goal of at least 2.";
  }
  return null;
}
