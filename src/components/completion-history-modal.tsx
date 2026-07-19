"use client";

import { useEffect, useState } from "react";
import type { Square } from "@/lib/firestore/cards";
import {
  getSquareCompletionHistory,
  updateSquareCompletionDate,
  type CompletionHistoryEntry,
} from "@/app/dashboard/cards/[id]/play/actions";

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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
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
        setRowErrors({});
      }
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [cardId, square.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function isDirty(entry: CompletionHistoryEntry): boolean {
    const draftValue = draftValues[entry.id];
    return draftValue !== undefined && draftValue !== isoToDateInputValue(entry.completedAt);
  }

  const dirtyEntries = (entries ?? []).filter(isDirty);

  async function handleSaveAll() {
    if (saving || dirtyEntries.length === 0) return;

    setSaving(true);
    setSaveError(null);
    setRowErrors({});

    try {
      const outcomes = await Promise.all(
        dirtyEntries.map(async (entry) => {
          const isoValue = dateInputValueToIso(draftValues[entry.id]);
          const result = await updateSquareCompletionDate(cardId, square.id, entry.id, isoValue);
          return { entry, result };
        }),
      );

      const failures = outcomes.filter(({ result }) => !result.ok);
      if (failures.length > 0) {
        setRowErrors(
          Object.fromEntries(
            failures.map(({ entry, result }) => [
              entry.id,
              result.ok ? "" : result.error,
            ]),
          ),
        );
        return;
      }

      const refreshed = await getSquareCompletionHistory(cardId, square.id);
      if (!refreshed.ok) {
        setSaveError(refreshed.error);
        return;
      }

      onEntriesChange?.(refreshed.entries);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Completion history for ${square.label}`}
        className="border-border bg-card text-card-foreground mx-4 flex max-h-[80vh] w-full max-w-sm flex-col gap-3 rounded-[var(--radius-sm)] border-2 p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold sm:text-base">Completion history — {square.label}</h2>
          <button
            type="button"
            aria-label="Close"
            className="border-border bg-card text-card-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs leading-none"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-sm">Loading…</p>}

          {!loading && loadError && (
            <p role="alert" className="text-destructive text-sm">
              {loadError}
            </p>
          )}

          {!loading && !loadError && entries && entries.length === 0 && (
            <p className="text-sm">No completions yet.</p>
          )}

          {!loading && !loadError && entries && entries.length > 0 && (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => {
                const draftValue = draftValues[entry.id] ?? isoToDateInputValue(entry.completedAt);
                const rowError = rowErrors[entry.id];

                return (
                  <li key={entry.id} className="flex flex-col gap-1">
                    <input
                      type="date"
                      className="border-border bg-card text-card-foreground w-full rounded-[var(--radius-sm)] border px-2 py-1 text-sm"
                      value={draftValue}
                      onChange={(event) =>
                        setDraftValues((prev) => ({ ...prev, [entry.id]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                          event.preventDefault();
                          handleSaveAll();
                        }
                      }}
                      disabled={saving}
                    />
                    {rowError && (
                      <p role="alert" className="text-destructive text-xs">
                        {rowError}
                      </p>
                    )}
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
              className="border-border bg-card text-card-foreground rounded-[var(--radius-sm)] border px-3 py-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              disabled={dirtyEntries.length === 0 || saving}
              onClick={handleSaveAll}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
