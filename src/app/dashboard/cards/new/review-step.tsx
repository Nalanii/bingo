"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { freeSpacePosition } from "@/lib/cards/grid";
import { saveCard } from "./actions";
import type { PositionedSquareDraft } from "./positions";
import type { CardSettings } from "./types";

type ReviewSquare =
  | (PositionedSquareDraft & { isFreeSpace?: false })
  | { position: number; label: string; isFreeSpace: true };

export function ReviewStep({
  settings,
  squares,
  onBack,
}: {
  settings: CardSettings;
  squares: PositionedSquareDraft[];
  onBack: () => void;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const allSquares: ReviewSquare[] = settings.hasFreeSpace
    ? [
        ...squares,
        {
          position: freeSpacePosition(settings.gridSize),
          label: "Free space",
          isFreeSpace: true,
        },
      ]
    : squares;

  // Sorted by position so RANDOM cards show their shuffled grid order, not
  // entry order.
  const orderedSquares = allSquares.sort((a, b) => a.position - b.position);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveCard(settings, squares);
      if (!result.ok) {
        setError(result.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review your card 🎉</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          Card &ldquo;{settings.name}&rdquo; · {settings.gridSize}×
          {settings.gridSize} · free space{" "}
          {settings.hasFreeSpace ? "on" : "off"} ·{" "}
          {settings.layout === "RANDOM" ? "random" : "set"} order
        </p>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {orderedSquares.map((square) => (
            <li key={square.position}>
              Slot {square.position + 1}: {square.label} ·{" "}
              {square.isFreeSpace
                ? "pre-complete"
                : square.kind === "COUNTER"
                  ? `counter to ${square.goal}`
                  : "check"}
            </li>
          ))}
        </ul>
        {error ? <p className="text-sm text-primary">{error}</p> : null}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={isPending}
            className="self-start"
          >
            ← Back
          </Button>
          <Button onClick={handleSave} disabled={isPending} className="self-end">
            {isPending ? "Saving…" : "Save card"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
