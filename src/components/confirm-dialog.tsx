"use client";

import { useRef, type ReactNode } from "react";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { useExitAnimation } from "@/lib/use-exit-animation";
import { cn } from "@/lib/utils";

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
 *
 * Plays a brief fade+pop exit animation before calling `onCancel`/
 * `onConfirm`, via `useExitAnimation` — the parent still controls whether
 * this component is mounted at all, but the actual close callback fires
 * `durationMs` after the user acts, giving the CSS animation time to run.
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
  const { state, requestClose } = useExitAnimation();
  const close = () => requestClose(onCancel);
  useDialogA11y(dialogRef, close);

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-black/50",
        zIndexClassName,
        state === "open"
          ? "[animation:fade-in_150ms_ease-out]"
          : "[animation:fade-out_150ms_ease-in]",
      )}
      onClick={close}
    >
      <div
        ref={manageFocus ? dialogRef : undefined}
        role="alertdialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        data-state={state}
        className={cn(
          "border-border bg-card text-card-foreground mx-4 flex w-full max-w-sm flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4 focus-visible:outline-none",
          state === "open"
            ? "[animation:pop-in_150ms_ease-out]"
            : "[animation:pop-out_150ms_ease-in]",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="border-control-border bg-card text-card-foreground focus-visible:ring-ring focus-visible:ring-offset-background cursor-pointer rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={close}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="border-destructive bg-destructive text-destructive-foreground focus-visible:ring-ring focus-visible:ring-offset-background cursor-pointer rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={() => requestClose(onConfirm)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
