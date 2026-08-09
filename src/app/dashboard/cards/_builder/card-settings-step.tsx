"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { isValidGridSize } from "@/lib/cards/grid";
import type { CardSettings } from "./types";

const NAME_MAX_LENGTH = 128;

export function CardSettingsStep({
  mode = "create",
  defaultValues,
  onComplete,
}: {
  mode?: "create" | "edit";
  defaultValues: CardSettings;
  onComplete: (settings: CardSettings) => void;
}) {
  const [name, setName] = React.useState(defaultValues.name);
  const [gridSize, setGridSize] = React.useState(defaultValues.gridSize);
  const [hasFreeSpace, setHasFreeSpace] = React.useState(
    defaultValues.hasFreeSpace,
  );
  const [layout, setLayout] = React.useState(defaultValues.layout);
  const [nameError, setNameError] = React.useState<string | null>(null);

  const locked = mode === "edit";

  const handleNext = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Give your card a name");
      return;
    }
    onComplete({ name: trimmedName, gridSize, hasFreeSpace, layout });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {locked ? (
            <>
              Edit card <span aria-hidden="true">✏️</span>
            </>
          ) : (
            <>
              Build a new card <span aria-hidden="true">🎲</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="card-name" className="text-sm font-semibold">
            Card name
          </label>
          <Input
            id="card-name"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Summer bucket list"
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
          />
          {nameError ? (
            <p role="alert" className="text-destructive text-sm">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Grid size</span>
          <Tooltip
            label={
              locked
                ? "Grid size can't be changed after a card is created"
                : undefined
            }
          >
            <SegmentedControl
              aria-label="Grid size"
              value={String(gridSize)}
              onChange={(value) => {
                // Parses a UI string value into one of the known grid sizes.
                const parsed = Number(value);
                setGridSize(isValidGridSize(parsed) ? parsed : 5);
              }}
              disabled={locked}
              aria-describedby={locked ? "settings-locked-note" : undefined}
              options={[
                { value: "3", label: "3×3" },
                { value: "5", label: "5×5" },
              ]}
            />
          </Tooltip>
        </div>

        <div className="flex items-center justify-between gap-4">
          <label htmlFor="free-space" className="text-sm font-semibold">
            Free space in the center
          </label>
          <Tooltip
            label={
              locked
                ? "Free space can't be changed after a card is created"
                : undefined
            }
          >
            <Switch
              id="free-space"
              checked={hasFreeSpace}
              onChange={setHasFreeSpace}
              disabled={locked}
              aria-label="Free space in the center"
              aria-describedby={locked ? "settings-locked-note" : undefined}
            />
          </Tooltip>
        </div>

        {locked ? (
          <p
            id="settings-locked-note"
            className="text-sm text-muted-foreground"
          >
            Grid size and free space can&rsquo;t be changed after a card is
            created.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Square order</span>
          <SegmentedControl
            aria-label="Square order"
            value={layout}
            onChange={(value) => setLayout(value === "SET" ? "SET" : "RANDOM")}
            options={[
              { value: "RANDOM", label: "Random" },
              { value: "SET", label: "Set" },
            ]}
          />
        </div>

        <Button onClick={handleNext} className="self-end">
          Next
        </Button>
      </CardContent>
    </Card>
  );
}
