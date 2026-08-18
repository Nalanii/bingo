"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Camera, ImagePlus, Trash2, X } from "lucide-react";
import type { Square } from "@/lib/firestore/cards";
import {
  getSquareCompletionHistory,
  removeSquareCompletionPhoto,
  updateSquareCompletionDate,
  updateSquareCompletionNote,
  uploadSquareCompletionPhoto,
  type CompletionHistoryEntry,
  type UpdateCompletionDateResult,
} from "@/app/dashboard/cards/[id]/play/actions";
import { MAX_NOTE_LENGTH } from "@/lib/completion-notes";
import {
  ALLOWED_PHOTO_TYPES_LABEL,
  MAX_PHOTO_SIZE_BYTES,
  isAllowedPhotoType,
} from "@/lib/completion-photos";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { useExitAnimation } from "@/lib/use-exit-animation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
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
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>({});
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});
  const [activePhotoEntryId, setActivePhotoEntryId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const { state, requestClose } = useExitAnimation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Note textareas start at one row and grow to fit their content (see
  // `data-autogrow` below); this re-measures them whenever draft note text
  // changes, including the initial values loaded from Firestore.
  useLayoutEffect(() => {
    const textareas = dialogRef.current?.querySelectorAll<HTMLTextAreaElement>(
      "textarea[data-autogrow]",
    );
    textareas?.forEach((textarea) => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, [draftNotes]);

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

  function openFilePicker(entryId: string) {
    setActivePhotoEntryId(entryId);
    fileInputRef.current?.click();
  }

  async function handlePhotoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const entryId = activePhotoEntryId;
    event.target.value = "";
    if (!file || !entryId) return;

    if (!isAllowedPhotoType(file.type)) {
      setPhotoErrors((prev) => ({
        ...prev,
        [entryId]: `Photo must be a ${ALLOWED_PHOTO_TYPES_LABEL} image.`,
      }));
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoErrors((prev) => ({
        ...prev,
        [entryId]: `Photo is too large (max ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB).`,
      }));
      return;
    }

    setPhotoErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => id !== entryId)),
    );
    setPhotoUploading((prev) => ({ ...prev, [entryId]: true }));

    const formData = new FormData();
    formData.append("photo", file);
    const result = await uploadSquareCompletionPhoto(cardId, square.id, entryId, formData);

    setPhotoUploading((prev) => ({ ...prev, [entryId]: false }));
    if (!result.ok) {
      setPhotoErrors((prev) => ({ ...prev, [entryId]: result.error }));
      return;
    }

    setEntries(
      (prev) =>
        prev?.map((entry) =>
          entry.id === entryId ? { ...entry, photoUrl: result.photoUrl } : entry,
        ) ?? prev,
    );
  }

  async function handleRemovePhoto(entryId: string) {
    setPhotoErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => id !== entryId)),
    );
    setPhotoUploading((prev) => ({ ...prev, [entryId]: true }));

    const result = await removeSquareCompletionPhoto(cardId, square.id, entryId);

    setPhotoUploading((prev) => ({ ...prev, [entryId]: false }));
    if (!result.ok) {
      setPhotoErrors((prev) => ({ ...prev, [entryId]: result.error }));
      return;
    }

    setEntries(
      (prev) =>
        prev?.map((entry) => (entry.id === entryId ? { ...entry, photoUrl: undefined } : entry)) ??
        prev,
    );
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
          // overflow-x-hidden: this dialog is `fixed`, so it sits outside
          // <body>'s own overflow clipping (fixed elements are positioned
          // against the viewport, not the body box) — without its own
          // clip, anything inside that renders wider than expected (native
          // date-input rendering varies a lot by platform/browser) can
          // still force horizontal scroll on the whole page.
          "border-border bg-card text-card-foreground mx-4 flex max-h-[80vh] w-full max-w-md flex-col gap-3 overflow-x-hidden rounded-[var(--radius-sm)] border-2 p-4 focus-visible:outline-none sm:max-w-lg",
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
                // Character count stays hidden until a note is most of the
                // way to the limit, so it doesn't clutter every short note.
                const showCounter = draftNote.length >= MAX_NOTE_LENGTH * 0.8;

                return (
                  <li
                    key={entry.id}
                    className="bg-muted flex w-full flex-col gap-2 rounded-[var(--radius-sm)] p-2 sm:flex-row sm:items-start"
                  >
                    {/* Grouped so the index+date pair can stack above the
                        note on mobile (`sm:contents` below makes this div
                        disappear as a box at sm+, so its children rejoin the
                        row layout for the wider desktop version). Native
                        `<input type="date">` rendering varies by platform —
                        notably iOS Safari can ignore `max-width` on it,
                        especially with larger system text sizes — so at
                        mobile widths it no longer shares a row with the note
                        field, avoiding the two ever competing for space and
                        forcing horizontal scroll. */}
                    <div className="flex items-start gap-2 sm:contents">
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground w-4 shrink-0 pt-1.5 text-right text-xs font-semibold"
                      >
                        {index + 1}.
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none sm:shrink-0">
                        <input
                          type="date"
                          aria-label={`Completion date, entry ${index + 1} of ${entriesAscending.length}`}
                          className="border-control-border bg-card text-card-foreground w-full max-w-[9rem] appearance-none rounded-[var(--radius-sm)] border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-fit"
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
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 pl-6 sm:pl-0">
                      <textarea
                        aria-label={`Note, entry ${index + 1} of ${entriesAscending.length}`}
                        className="border-control-border bg-card text-card-foreground w-full resize-none overflow-hidden rounded-[var(--radius-sm)] border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        placeholder="Add a note…"
                        maxLength={MAX_NOTE_LENGTH}
                        rows={1}
                        data-autogrow
                        value={draftNote}
                        onChange={(event) =>
                          setDraftNotes((prev) => ({ ...prev, [entry.id]: event.target.value }))
                        }
                        onKeyDown={handleSaveShortcut}
                        disabled={saving}
                      />
                      {noteError && (
                        <p role="alert" className="text-destructive text-xs">
                          {noteError}
                        </p>
                      )}
                      {showCounter && (
                        <span className="text-muted-foreground self-end text-xs">
                          {draftNote.length}/{MAX_NOTE_LENGTH}
                        </span>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {entry.photoUrl && (
                          <button
                            type="button"
                            aria-label={`View photo, entry ${index + 1} of ${entriesAscending.length}`}
                            className="border-control-border overflow-hidden rounded-[var(--radius-sm)] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            onClick={() => setLightboxUrl(entry.photoUrl ?? null)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- signed Firebase Storage URL, not a static asset next/image's optimizer would help with. */}
                            <img
                              src={entry.photoUrl}
                              alt={`Photo for entry ${index + 1}`}
                              className="h-12 w-12 object-cover"
                            />
                          </button>
                        )}
                        <button
                          type="button"
                          className="border-control-border bg-card text-card-foreground flex cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-xs font-medium hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={photoUploading[entry.id]}
                          onClick={() => openFilePicker(entry.id)}
                        >
                          {photoUploading[entry.id] ? (
                            <Spinner className="h-3 w-3" />
                          ) : entry.photoUrl ? (
                            <ImagePlus className="h-3 w-3" />
                          ) : (
                            <Camera className="h-3 w-3" />
                          )}
                          {entry.photoUrl ? "Replace photo" : "Add photo"}
                        </button>
                        {entry.photoUrl && (
                          <button
                            type="button"
                            className="text-destructive flex cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={photoUploading[entry.id]}
                            onClick={() => handleRemovePhoto(entry.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        )}
                      </div>
                      {photoErrors[entry.id] && (
                        <p role="alert" className="text-destructive text-xs">
                          {photoErrors[entry.id]}
                        </p>
                      )}
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handlePhotoFileChange}
        />
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Firebase Storage URL, not a static asset next/image's optimizer would help with. */}
          <img
            src={lightboxUrl}
            alt="Completion photo"
            className="max-h-full max-w-full rounded-[var(--radius-sm)]"
          />
          <button
            type="button"
            aria-label="Close photo"
            className="border-control-border bg-card text-card-foreground absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={(event) => {
              event.stopPropagation();
              setLightboxUrl(null);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
