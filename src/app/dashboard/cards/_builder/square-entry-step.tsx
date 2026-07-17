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
import type { CardSettings, SquareDraft } from "./types";

const LABEL_MAX_LENGTH = 128;
const DEFAULT_GOAL = 2;

function squareCount(settings: CardSettings): number {
  return (
    settings.gridSize * settings.gridSize - (settings.hasFreeSpace ? 1 : 0)
  );
}

function seedSquares(
  settings: CardSettings,
  defaultValues: SquareDraft[],
): SquareDraft[] {
  const count = squareCount(settings);
  return Array.from({ length: count }, (_, index) => {
    const existing = defaultValues[index];
    return existing
      ? { ...existing }
      : { label: "", kind: "CHECK" as const, goal: 1 };
  });
}

export function SquareEntryStep({
  settings,
  defaultValues,
  onComplete,
  onBack,
}: {
  settings: CardSettings;
  defaultValues: SquareDraft[];
  onComplete: (squares: SquareDraft[]) => void;
  onBack: (squares: SquareDraft[]) => void;
}) {
  const [squares, setSquares] = React.useState<SquareDraft[]>(() =>
    seedSquares(settings, defaultValues),
  );
  const [errorIndex, setErrorIndex] = React.useState<number | null>(null);
  const labelRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  const updateSquare = (index: number, patch: Partial<SquareDraft>) => {
    setSquares((prev) =>
      prev.map((square, i) => (i === index ? { ...square, ...patch } : square)),
    );
    if (errorIndex === index) setErrorIndex(null);
  };

  const handleKindChange = (index: number, value: string) => {
    if (value === "COUNTER") {
      updateSquare(index, { kind: "COUNTER", goal: DEFAULT_GOAL });
    } else {
      updateSquare(index, { kind: "CHECK", goal: 1 });
    }
  };

  const handleNext = () => {
    const firstEmpty = squares.findIndex((square) => !square.label.trim());
    if (firstEmpty !== -1) {
      setErrorIndex(firstEmpty);
      labelRefs.current[firstEmpty]?.focus();
      return;
    }
    onComplete(
      squares.map((square) => ({ ...square, label: square.label.trim() })),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fill in your squares 📝</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {squares.map((square, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0 last:pb-0"
          >
            <span className="text-sm font-semibold">Square {index + 1}</span>
            <Input
              ref={(el) => {
                labelRefs.current[index] = el;
              }}
              value={square.label}
              maxLength={LABEL_MAX_LENGTH}
              placeholder="Do something bingo-worthy"
              aria-label={`Square ${index + 1} label`}
              onChange={(event) =>
                updateSquare(index, { label: event.target.value })
              }
            />
            {errorIndex === index ? (
              <p className="text-sm text-primary">Give this square a label</p>
            ) : null}
            <div className="flex items-center gap-4">
              <SegmentedControl
                aria-label={`Square ${index + 1} type`}
                value={square.kind}
                onChange={(value) => handleKindChange(index, value)}
                options={[
                  { value: "CHECK", label: "Check" },
                  { value: "COUNTER", label: "Counter" },
                ]}
              />
              {square.kind === "COUNTER" ? (
                <Input
                  type="number"
                  min={2}
                  value={square.goal}
                  aria-label={`Square ${index + 1} goal`}
                  className="w-20"
                  onChange={(event) =>
                    updateSquare(index, {
                      goal: Number(event.target.value) || 0,
                    })
                  }
                  onBlur={(event) =>
                    updateSquare(index, {
                      goal: Math.max(2, Number(event.target.value) || 2),
                    })
                  }
                />
              ) : null}
            </div>
          </div>
        ))}

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => onBack(squares)}
            className="self-start"
          >
            ← Back
          </Button>
          <Button onClick={handleNext} className="self-end">
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
