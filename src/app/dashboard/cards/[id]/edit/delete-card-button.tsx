"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { SaveCardResult } from "../../_builder/types";

export function DeleteCardButton({
  onDelete,
}: {
  onDelete: () => Promise<SaveCardResult>;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await onDelete();
      if (!result.ok) {
        setError(result.error);
      }
    });
  };

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        className="self-start border-destructive text-destructive hover:border-destructive"
        onClick={() => setConfirming(true)}
      >
        Delete card
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground">
        Delete this card for good? This can&rsquo;t be undone.
      </p>
      {error ? <p className="text-sm text-primary">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={isPending}
          onClick={handleDelete}
        >
          {isPending ? "Deleting…" : "Yes, delete it"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
