"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Square } from "@/lib/firestore/cards";
import {
  getSquareCompletionHistory,
  updateSquareCompletionDate,
  updateSquareCompletionNote,
  type CompletionHistoryEntry,
  type UpdateCompletionDateResult,
} from "@/app/dashboard/cards/[id]/play/actions";
import { MAX_NOTE_LENGTH } from "@/lib/completion-notes";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { useExitAnimation } from "@/lib/use-exit-animation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

interface CompletionHistoryModalProps {
  cardId: string;
  square: Square;
  onClose: () => void;
  /** Called whenever this square's completion entries are freshly fetched (initial load and after a save), so callers can keep their own "latest completion" state in sync. */
  onEntriesChange?: (entries: CompletionHistoryEntry[]) => void;
}

/** Converts an ISO 8601 timestamp to a `YYYY-MM-DD` value using local calendar date components. */
function isoToDateInputValue(completedAt: string): string {
  const date = new Date(completedAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Converts a `YYYY-MM-DD` date-input value to an ISO 8601 string at local midnight for that date. */
function dateInputValueToIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toISOString();
}

/** True for a complete, real `YYYY-MM-DD` value — false for "" (a cleared input) or a partial/invalid one. */
function isValidDateInputValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Modal dialog listing a square's completion history, with an editable date
 * per entry and a single Save button that commits every changed entry at
 * once. Owns its own fetch/loading/error/save state.
 */
export function CompletionHistoryModal({
  cardId,
  square,
  onClose,
  onEntriesChange,
}: CompletionHistoryModalProps) {
  const [entries, setEntries] = useState<CompletionHistoryEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dateErrors, setDateErrors] = useState<Record<string, string>>({});
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const { state, requestClose } = useExitAnimation();

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      setStatusMessage("Loading completion history…");
      const result = await getSquareCompletionHistory(cardId, square.id);
      if (cancelled) return;

      if (!result.ok) {
        setLoadError(result.error);
        setEntries(null);
      } else {
        setEntries(result.entries);
        setDraftValues(
          Object.fromEntries(
            result.entries.map((entry) => [entry.id, isoToDateInputValue(entry.completedAt)]),
          ),
        );
        setDraftNotes(
          Object.fromEntries(result.entries.map((entry) => [entry.id, entry.note ?? ""])),
        );
        setDateErrors({});
        setNoteErrors({});
      }
      setLoading(false);
      setStatusMessage("");
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [cardId, square.id]);

  function isDateDirty(entry: CompletionHistoryEntry): boolean {
    const draftValue = draftValues[entry.id];
    return draftValue !== undefined && draftValue !== isoToDateInputValue(entry.completedAt);
  }

  function isNoteDirty(entry: CompletionHistoryEntry): boolean {
    const draftNote = draftNotes[entry.id];
    return draftNote !== undefined && draftNote !== (entry.note ?? "");
  }

  const dirtyEntries = (entries ?? []).filter(
    (entry) => isDateDirty(entry) || isNoteDirty(entry),
  );

  // `entries` itself stays in the server's newest-first order (bingo-grid.tsx
  // relies on entries[0] being the most recent completion); this is just a
  // display-order copy, oldest first, for the list below.
  const entriesAscending = entries
    ? [...entries].sort(
        (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
      )
    : null;

  /** Closes the modal directly if nothing is dirty, otherwise asks for confirmation first. */
  function attemptClose() {
    if (dirtyEntries.length > 0) {
      setShowDiscardConfirm(true);
      return;
    }
    requestClose(onClose);
  }

  useDialogA11y(dialogRef, attemptClose);

  async function handleSaveAll() {
    if (saving || dirtyEntries.length === 0) return;

    const invalidDateEntries = dirtyEntries.filter(
      (entry) => isDateDirty(entry) && !isValidDateInputValue(draftValues[entry.id]),
    );
    const invalidNoteEntries = dirtyEntries.filter(
      (entry) => isNoteDirty(entry) && draftNotes[entry.id].trim().length > MAX_NOTE_LENGTH,
    );
    if (invalidDateEntries.length > 0 || invalidNoteEntries.length > 0) {
      setDateErrors(
        Object.fromEntries(invalidDateEntries.map((entry) => [entry.id, "Enter a valid date."])),
      );
      setNoteErrors(
        Object.fromEntries(
          invalidNoteEntries.map((entry) => [
            entry.id,
            `Note is too long (max ${MAX_NOTE_LENGTH} characters).`,
          ]),
        ),
      );
      return;
    }

    setSaving(true);
    setSaveError(null);
    setDateErrors({});
    setNoteErrors({});

    try {
      const updates: Promise<{
        entry: CompletionHistoryEntry;
        kind: "date" | "note";
        result: UpdateCompletionDateResult;
      }>[] = [];
      for (const entry of dirtyEntries) {
        if (isDateDirty(entry)) {
          updates.push(
            updateSquareCompletionDate(
              cardId,
              square.id,
              entry.id,
              dateInputValueToIso(draftValues[entry.id]),
            ).then((result) => ({ entry, kind: "date" as const, result })),
          );
        }
        if (isNoteDirty(entry)) {
          updates.push(
            updateSquareCompletionNote(cardId, square.id, entry.id, draftNotes[entry.id]).then(
              (result) => ({ entry, kind: "note" as const, result }),
            ),
          );
        }
      }
      const outcomes = await Promise.all(updates);

      const failures = outcomes.filter(({ result }) => !result.ok);
      if (failures.length > 0) {
        setDateErrors(
          Object.fromEntries(
            failures
              .filter(({ kind }) => kind === "date")
              .map(({ entry, result }) => [entry.id, result.ok ? "" : result.error]),
          ),
        );
        setNoteErrors(
          Object.fromEntries(
            failures
              .filter(({ kind }) => kind === "note")
              .map(({ entry, result }) => [entry.id, result.ok ? "" : result.error]),
          ),
        );
        return;
      }

      const refreshed = await getSquareCompletionHistory(cardId, square.id);
      if (!refreshed.ok) {
        setSaveError(refreshed.error);
        return;
      }

      setDraftNotes(
        Object.fromEntries(refreshed.entries.map((entry) => [entry.id, entry.note ?? ""])),
      );
      onEntriesChange?.(refreshed.entries);
      requestClose(onClose);
    } finally {
      setSaving(false);
    }
  }

  /** Ctrl/Cmd+Enter saves from within a date input or note textarea; plain Enter is left alone. */
  function handleSaveShortcut(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      handleSaveAll();
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
        state === "open"
          ? "[animation:fade-in_150ms_ease-out]"
          : "[animation:fade-out_150ms_ease-in]",
      )}
      onClick={attemptClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Completion history for ${square.label}`}
        tabIndex={-1}
        data-state={state}
        className={cn(
          "border-border bg-card text-card-foreground mx-4 flex max-h-[80vh] w-fit max-w-sm min-w-[16rem] flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4 focus-visible:outline-none",
          state === "open"
            ? "[animation:pop-in_150ms_ease-out]"
            : "[animation:pop-out_150ms_ease-in]",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="flex flex-col text-sm font-bold sm:text-base">
            Completion history
            <span className="text-muted-foreground text-xs font-normal">{square.label}</span>
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="border-control-border bg-card text-card-foreground flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border text-xs leading-none hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={attemptClose}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p role="status" className="sr-only">
            {statusMessage}
          </p>
          {loading && <p className="text-sm">Loading…</p>}

          {!loading && loadError && (
            <p role="alert" className="text-destructive text-sm">
              {loadError}
            </p>
          )}

          {!loading && !loadError && entries && entries.length === 0 && (
            <p className="text-sm [animation:fade-in_300ms_ease-out]">No completions yet.</p>
          )}

          {!loading && !loadError && entriesAscending && entriesAscending.length > 0 && (
            <ul className="flex flex-col gap-3">
              {entriesAscending.map((entry, index) => {
                const draftValue = draftValues[entry.id] ?? isoToDateInputValue(entry.completedAt);
                const draftNote = draftNotes[entry.id] ?? (entry.note ?? "");
                const dateError = dateErrors[entry.id];
                const noteError = noteErrors[entry.id];

                return (
                  <li
                    key={entry.id}
                    className="bg-muted flex w-full items-center gap-2 rounded-[var(--radius-sm)] p-2"
                  >
                    <span
                      aria-hidden="true"
                      className="text-muted-foreground w-4 shrink-0 text-right text-xs font-semibold"
                    >
                      {index + 1}.
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <input
                        type="date"
                        aria-label={`Completion date, entry ${index + 1} of ${entriesAscending.length}`}
                        className="border-control-border bg-card text-card-foreground w-fit max-w-[9rem] appearance-none rounded-[var(--radius-sm)] border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        value={draftValue}
                        onChange={(event) =>
                          setDraftValues((prev) => ({ ...prev, [entry.id]: event.target.value }))
                        }
                        onKeyDown={handleSaveShortcut}
                        disabled={saving}
                      />
                      {dateError && (
                        <p role="alert" className="text-destructive text-xs">
                          {dateError}
                        </p>
                      )}
                      <textarea
                        aria-label={`Note, entry ${index + 1} of ${entriesAscending.length}`}
                        className="border-control-border bg-card text-card-foreground w-full rounded-[var(--radius-sm)] border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        placeholder="Add a note…"
                        maxLength={MAX_NOTE_LENGTH}
                        rows={2}
                        value={draftNote}
                        onChange={(event) =>
                          setDraftNotes((prev) => ({ ...prev, [entry.id]: event.target.value }))
                        }
                        onKeyDown={handleSaveShortcut}
                        disabled={saving}
                      />
                      <div className="flex items-center justify-between gap-2">
                        {noteError && (
                          <p role="alert" className="text-destructive text-xs">
                            {noteError}
                          </p>
                        )}
                        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                          {draftNote.length}/{MAX_NOTE_LENGTH}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!loading && !loadError && entries && entries.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            {saveError && (
              <p role="alert" className="text-destructive text-xs">
                {saveError}
              </p>
            )}
            <button
              type="button"
              className="border-control-border bg-card text-card-foreground cursor-pointer rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:hover:border-control-border disabled:opacity-40"
              disabled={dirtyEntries.length === 0 || saving}
              onClick={handleSaveAll}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {showDiscardConfirm && (
        <ConfirmDialog
          ariaLabel="Discard unsaved changes?"
          message={
            <>
              Discard unsaved changes to <span className="font-bold">{square.label}</span>
              &rsquo;s completion history?
            </>
          }
          cancelLabel="Keep editing"
          confirmLabel="Discard"
          zIndexClassName="z-[60]"
          manageFocus={false}
          onCancel={() => setShowDiscardConfirm(false)}
          onConfirm={() => requestClose(onClose)}
        />
      )}
    </div>
  );
}
