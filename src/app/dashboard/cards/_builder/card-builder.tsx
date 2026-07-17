"use client";

import * as React from "react";
import { CardSettingsStep } from "./card-settings-step";
import {
  assignPositions,
  attachExistingPositions,
  type PositionedSquareDraft,
} from "./positions";
import { ReviewStep } from "./review-step";
import { SquareEntryStep } from "./square-entry-step";
import type { CardSettings, SaveCardResult, SquareDraft } from "./types";

const DEFAULT_SETTINGS: CardSettings = {
  name: "",
  gridSize: 5,
  hasFreeSpace: true,
  layout: "RANDOM",
};

function toSquareDrafts(squares: PositionedSquareDraft[]): SquareDraft[] {
  return squares.map(({ label, kind, goal }) => ({ label, kind, goal }));
}

export function CardBuilder({
  mode = "create",
  initialSettings,
  initialSquares,
  onSave,
}: {
  mode?: "create" | "edit";
  initialSettings?: CardSettings;
  initialSquares?: PositionedSquareDraft[];
  onSave: (
    settings: CardSettings,
    squares: PositionedSquareDraft[],
  ) => Promise<SaveCardResult>;
}) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [settings, setSettings] = React.useState<CardSettings>(
    initialSettings ?? DEFAULT_SETTINGS,
  );
  const [squares, setSquares] = React.useState<SquareDraft[]>(() =>
    initialSquares ? toSquareDrafts(initialSquares) : [],
  );
  const [positionedSquares, setPositionedSquares] = React.useState<
    PositionedSquareDraft[]
  >([]);

  // Each step fully unmounts the others (rather than hiding them), so every
  // step always remounts fresh from the latest lifted state (`settings`,
  // `squares`) when navigating — keep it that way, or a step's
  // defaultValues-seeded local state will go stale.
  if (step === 3) {
    return (
      <ReviewStep
        mode={mode}
        settings={settings}
        squares={positionedSquares}
        onBack={() => setStep(2)}
        onSave={onSave}
      />
    );
  }

  if (step === 2) {
    return (
      <SquareEntryStep
        settings={settings}
        defaultValues={squares}
        onComplete={(nextSquares) => {
          setSquares(nextSquares);
          // Positions are assigned once here, when the card's contents are
          // finalized, so a RANDOM card's layout stays put through review
          // (and later, once persisted, on every future visit). In edit mode,
          // grid size and free space are locked, so the square count never
          // changes — re-attach each square to its original position instead
          // of reshuffling.
          setPositionedSquares(
            mode === "edit" && initialSquares
              ? attachExistingPositions(nextSquares, initialSquares)
              : assignPositions(nextSquares, settings),
          );
          setStep(3);
        }}
        onBack={(nextSquares) => {
          setSquares(nextSquares);
          setStep(1);
        }}
      />
    );
  }

  return (
    <CardSettingsStep
      mode={mode}
      defaultValues={settings}
      onComplete={(nextSettings) => {
        setSettings(nextSettings);
        setStep(2);
      }}
    />
  );
}
