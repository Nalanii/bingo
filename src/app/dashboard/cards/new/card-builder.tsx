"use client";

import * as React from "react";
import { CardSettingsStep } from "./card-settings-step";
import { SquareEntryStepStub } from "./square-entry-step-stub";
import type { CardSettings } from "./types";

const DEFAULT_SETTINGS: CardSettings = {
  name: "",
  gridSize: 5,
  hasFreeSpace: true,
  layout: "RANDOM",
};

export function CardBuilder() {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [settings, setSettings] = React.useState<CardSettings>(DEFAULT_SETTINGS);

  // Each step fully unmounts the other (rather than hiding it), so
  // CardSettingsStep always remounts fresh from the latest `settings` when
  // navigating back — keep it that way, or its defaultValues-seeded local
  // state will go stale.
  if (step === 2) {
    return (
      <SquareEntryStepStub settings={settings} onBack={() => setStep(1)} />
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
