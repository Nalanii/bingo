// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Square } from "@/lib/firestore/cards";
import type { CompletionHistoryEntry } from "@/app/dashboard/cards/[id]/play/actions";
import {
  getSquareCompletionHistory,
  updateSquareCompletionDate,
  updateSquareCompletionNote,
} from "@/app/dashboard/cards/[id]/play/actions";
import { MAX_NOTE_LENGTH } from "@/lib/completion-notes";
import { CompletionHistoryModal } from "./completion-history-modal";

vi.mock("@/app/dashboard/cards/[id]/play/actions", () => ({
  getSquareCompletionHistory: vi.fn(),
  updateSquareCompletionDate: vi.fn(),
  updateSquareCompletionNote: vi.fn(),
}));

const mockGetHistory = vi.mocked(getSquareCompletionHistory);
const mockUpdateDate = vi.mocked(updateSquareCompletionDate);
const mockUpdateNote = vi.mocked(updateSquareCompletionNote);

const cardId = "card-1";
const square: Square = {
  id: "square-1",
  position: 0,
  label: "Read a book",
  kind: "CHECK",
  goal: 1,
  isFreeSpace: false,
};

const initialNote = "Original note";
const baseEntry: CompletionHistoryEntry = {
  id: "entry-1",
  completedAt: "2026-08-01T12:00:00.000Z",
  note: initialNote,
};

function renderModal() {
  return render(<CompletionHistoryModal cardId={cardId} square={square} onClose={vi.fn()} />);
}

/** Waits for the loaded row's controls, since they only exist after the initial fetch resolves. */
async function getControls() {
  const dateInput = await screen.findByLabelText("Completion date, entry 1 of 1");
  const noteTextarea = screen.getByLabelText("Note, entry 1 of 1");
  const saveButton = screen.getByRole("button", { name: "Save" });
  return { dateInput, noteTextarea, saveButton };
}

describe("CompletionHistoryModal", () => {
  beforeEach(() => {
    mockGetHistory.mockReset();
    mockUpdateDate.mockReset();
    mockUpdateNote.mockReset();
    mockGetHistory.mockResolvedValue({ ok: true, entries: [baseEntry] });
    mockUpdateDate.mockResolvedValue({ ok: true });
    mockUpdateNote.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves only the date when only the date was edited", async () => {
    renderModal();
    const { dateInput, saveButton } = await getControls();

    fireEvent.change(dateInput, { target: { value: "2026-08-05" } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockUpdateDate).toHaveBeenCalledTimes(1));
    expect(mockUpdateDate).toHaveBeenCalledWith(cardId, square.id, "entry-1", expect.any(String));
    expect(mockUpdateNote).not.toHaveBeenCalled();
    await waitFor(() => expect(mockGetHistory).toHaveBeenCalledTimes(2));
  });

  it("saves only the note when only the note was edited", async () => {
    renderModal();
    const { noteTextarea, saveButton } = await getControls();

    fireEvent.change(noteTextarea, { target: { value: "Updated note" } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockUpdateNote).toHaveBeenCalledTimes(1));
    expect(mockUpdateNote).toHaveBeenCalledWith(cardId, square.id, "entry-1", "Updated note");
    expect(mockUpdateDate).not.toHaveBeenCalled();
    await waitFor(() => expect(mockGetHistory).toHaveBeenCalledTimes(2));
  });

  it("saves both the date and the note when both were edited", async () => {
    renderModal();
    const { dateInput, noteTextarea, saveButton } = await getControls();

    fireEvent.change(dateInput, { target: { value: "2026-08-05" } });
    fireEvent.change(noteTextarea, { target: { value: "Updated note" } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockUpdateDate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockUpdateNote).toHaveBeenCalledTimes(1));
    expect(mockUpdateDate).toHaveBeenCalledWith(cardId, square.id, "entry-1", expect.any(String));
    expect(mockUpdateNote).toHaveBeenCalledWith(cardId, square.id, "entry-1", "Updated note");
    await waitFor(() => expect(mockGetHistory).toHaveBeenCalledTimes(2));
  });

  it("shows a date-update failure under the date input, not the note textarea, when the note update succeeds", async () => {
    mockUpdateDate.mockResolvedValue({
      ok: false,
      error: "Completion date can't be in the future.",
    });
    renderModal();
    const { dateInput, noteTextarea, saveButton } = await getControls();

    fireEvent.change(dateInput, { target: { value: "2026-08-05" } });
    fireEvent.change(noteTextarea, { target: { value: "Updated note" } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockUpdateDate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockUpdateNote).toHaveBeenCalledTimes(1));

    const dateError = await screen.findByText("Completion date can't be in the future.");
    // The old implementation rendered every row error in one shared slot
    // positioned after the note textarea, regardless of which control the
    // error was actually about. The fix renders each field's error directly
    // under that field, so the date error must be the date input's sibling.
    expect(dateInput.nextElementSibling).toBe(dateError);
    expect(noteTextarea.nextElementSibling?.textContent ?? "").not.toContain(
      "Completion date can't be in the future.",
    );
    // The note update succeeded, so no note error should render at all.
    expect(screen.queryByText(/^Bad note/)).not.toBeInTheDocument();
  });

  it("keeps both a date error and a note error visible when both updates fail for the same entry", async () => {
    mockUpdateDate.mockResolvedValue({ ok: false, error: "Bad date." });
    mockUpdateNote.mockResolvedValue({ ok: false, error: "Bad note." });
    renderModal();
    const { dateInput, noteTextarea, saveButton } = await getControls();

    fireEvent.change(dateInput, { target: { value: "2026-08-05" } });
    fireEvent.change(noteTextarea, { target: { value: "Updated note" } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockUpdateDate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockUpdateNote).toHaveBeenCalledTimes(1));

    // Old behavior merged both failures into a single `rowErrors[entry.id]`
    // slot via Object.fromEntries, so whichever update's outcome was written
    // last silently clobbered the other -- only one message ever survived.
    expect(await screen.findByText("Bad date.")).toBeInTheDocument();
    expect(await screen.findByText("Bad note.")).toBeInTheDocument();
  });

  it("shows a live character counter for the note textarea based on the current draft value", async () => {
    renderModal();
    const { noteTextarea } = await getControls();

    expect(screen.getByText(`${initialNote.length}/${MAX_NOTE_LENGTH}`)).toBeInTheDocument();

    fireEvent.change(noteTextarea, { target: { value: "abc" } });

    expect(screen.getByText(`3/${MAX_NOTE_LENGTH}`)).toBeInTheDocument();
  });
});
