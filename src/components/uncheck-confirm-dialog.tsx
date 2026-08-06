"use client";

import { useRef } from "react";
import { useDialogA11y } from "@/lib/use-dialog-a11y";

interface UncheckConfirmDialogProps {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms un-checking a CHECK square, since doing so permanently deletes
 * its only completion record. An `alertdialog` (not a plain `dialog`) since
 * it's interrupting the user about a destructive, irreversible action.
 */
export function UncheckConfirmDialog({ label, onCancel, onConfirm }: UncheckConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onCancel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Undo completion of ${label}?`}
        tabIndex={-1}
        className="border-border bg-card text-card-foreground mx-4 flex w-full max-w-sm flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4 focus-visible:outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm">
          Undo completion of <span className="font-bold">{label}</span>? This permanently deletes
          its completion history.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="border-control-border bg-card text-card-foreground focus-visible:ring-ring focus-visible:ring-offset-background rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="border-destructive bg-destructive text-destructive-foreground focus-visible:ring-ring focus-visible:ring-offset-background rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={onConfirm}
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  );
}
