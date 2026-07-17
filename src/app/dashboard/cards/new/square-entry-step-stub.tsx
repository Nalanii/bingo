"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CardSettings } from "./types";

export function SquareEntryStepStub({
  settings,
  onBack,
}: {
  settings: CardSettings;
  onBack: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Square entry (coming soon) 🚧</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          Card &ldquo;{settings.name}&rdquo; · {settings.gridSize}×
          {settings.gridSize} · free space{" "}
          {settings.hasFreeSpace ? "on" : "off"} ·{" "}
          {settings.layout === "RANDOM" ? "random" : "set"} order
        </p>
        <p className="text-sm text-muted-foreground">
          Filling in each square is tracked in issue #2.
        </p>
        <Button variant="outline" onClick={onBack} className="self-start">
          ← Back
        </Button>
      </CardContent>
    </Card>
  );
}
