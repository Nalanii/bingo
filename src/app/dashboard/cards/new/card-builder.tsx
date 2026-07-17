"use client";

import * as React from "react";
import { CardSettingsStep } from "./card-settings-step";
import { ReviewStepStub } from "./review-step-stub";
import { SquareEntryStep } from "./square-entry-step";
import type { CardSettings, SquareDraft } from "./types";

const DEFAULT_SETTINGS: CardSettings = {
  name: "",
  gridSize: 5,
  hasFreeSpace: true,
  layout: "RANDOM",
};

export function CardBuilder() {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [settings, setSettings] = React.useState<CardSettings>(DEFAULT_SETTINGS);
  const [squares, setSquares] = React.useState<SquareDraft[]>([]);

  // Each step fully unmounts the others (rather than hiding them), so every
  // step always remounts fresh from the latest lifted state (`settings`,
  // `squares`) when navigating — keep it that way, or a step's
  // defaultValues-seeded local state will go stale.
  if (step === 3) {
    return (
      <ReviewStepStub
        settings={settings}
        squares={squares}
        onBack={() => setStep(2)}
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
      defaultValues={settings}
      onComplete={(nextSettings) => {
        setSettings(nextSettings);
        setStep(2);
      }}
    />
  );
}
