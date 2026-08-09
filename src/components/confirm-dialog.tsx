"use client";

import { useRef, type ReactNode } from "react";
import { useDialogA11y } from "@/lib/use-dialog-a11y";

interface ConfirmDialogProps {
  ariaLabel: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Overlay stacking order; bump this when the dialog nests above another dialog. */
  zIndexClassName?: string;
  /** Wires Escape-to-close and Tab focus trapping via useDialogA11y. */
  manageFocus?: boolean;
}

/**
 * Shared alertdialog chrome for confirm/cancel prompts — an overlay plus a
 * centered dialog with a message and two action buttons. Used for
 * destructive or discard-style confirmations that interrupt the user.
 */
export function ConfirmDialog({
  ariaLabel,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
  zIndexClassName = "z-50",
  manageFocus = true,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onCancel);

  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-black/50`}
      onClick={onCancel}
    >
      <div
        ref={manageFocus ? dialogRef : undefined}
        role="alertdialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className="border-border bg-card text-card-foreground mx-4 flex w-full max-w-sm flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4 focus-visible:outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="border-control-border bg-card text-card-foreground focus-visible:ring-ring focus-visible:ring-offset-background cursor-pointer rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="border-destructive bg-destructive text-destructive-foreground focus-visible:ring-ring focus-visible:ring-offset-background cursor-pointer rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
