"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PositionedSquareDraft } from "./positions";
import type { CardSettings } from "./types";

export function ReviewStepStub({
  settings,
  squares,
  onBack,
}: {
  settings: CardSettings;
  squares: PositionedSquareDraft[];
  onBack: () => void;
}) {
  // Sorted by position so RANDOM cards show their shuffled grid order, not
  // entry order.
  const orderedSquares = [...squares].sort((a, b) => a.position - b.position);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review (coming soon) 🚧</CardTitle>
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
              {square.kind === "COUNTER"
                ? `counter to ${square.goal}`
                : "check"}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Saving is tracked in issue #4.
        </p>
        <Button variant="outline" onClick={onBack} className="self-start">
          ← Back
        </Button>
      </CardContent>
    </Card>
  );
}
