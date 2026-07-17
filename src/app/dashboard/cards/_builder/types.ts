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

export type SaveCardResult = { ok: true } | { ok: false; error: string };
