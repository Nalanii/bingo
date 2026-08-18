// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Square } from "@/lib/firestore/cards";
import type { CompletionHistoryEntry } from "@/app/dashboard/cards/[id]/play/actions";
import {
  getSquareCompletionHistory,
  removeSquareCompletionPhoto,
  updateSquareCompletionDate,
  updateSquareCompletionNote,
  uploadSquareCompletionPhoto,
} from "@/app/dashboard/cards/[id]/play/actions";
import { MAX_NOTE_LENGTH } from "@/lib/completion-notes";
import { MAX_PHOTO_SIZE_BYTES } from "@/lib/completion-photos";
import { CompletionHistoryModal } from "./completion-history-modal";

vi.mock("@/app/dashboard/cards/[id]/play/actions", () => ({
  getSquareCompletionHistory: vi.fn(),
  updateSquareCompletionDate: vi.fn(),
  updateSquareCompletionNote: vi.fn(),
  uploadSquareCompletionPhoto: vi.fn(),
  removeSquareCompletionPhoto: vi.fn(),
}));

const mockGetHistory = vi.mocked(getSquareCompletionHistory);
const mockUpdateDate = vi.mocked(updateSquareCompletionDate);
const mockUpdateNote = vi.mocked(updateSquareCompletionNote);
const mockUploadPhoto = vi.mocked(uploadSquareCompletionPhoto);
const mockRemovePhoto = vi.mocked(removeSquareCompletionPhoto);

/** Builds a fake image File of the given size, for upload-control tests. */
function makeImageFile(name: string, sizeBytes: number, type = "image/png"): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

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
    mockUploadPhoto.mockReset();
    mockRemovePhoto.mockReset();
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

  it("hides the character counter for a short note and shows it once the note nears the length limit", async () => {
    renderModal();
    const { noteTextarea } = await getControls();

    expect(screen.queryByText(`${initialNote.length}/${MAX_NOTE_LENGTH}`)).not.toBeInTheDocument();

    const longNote = "a".repeat(Math.ceil(MAX_NOTE_LENGTH * 0.8));
    fireEvent.change(noteTextarea, { target: { value: longNote } });

    expect(screen.getByText(`${longNote.length}/${MAX_NOTE_LENGTH}`)).toBeInTheDocument();
  });

  it("uploads a photo and shows its thumbnail on success", async () => {
    mockUploadPhoto.mockResolvedValue({ ok: true, photoUrl: "https://storage.example/photo.png" });
    renderModal();
    await getControls();

    const addButton = screen.getByRole("button", { name: "Add photo" });
    fireEvent.click(addButton);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeImageFile("photo.png", 1024);
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadPhoto).toHaveBeenCalledTimes(1));
    expect(mockUploadPhoto).toHaveBeenCalledWith(cardId, square.id, "entry-1", expect.any(FormData));
    expect(await screen.findByAltText("Photo for entry 1")).toBeInTheDocument();
  });

  it("rejects an oversized photo before calling the upload action", async () => {
    renderModal();
    await getControls();

    fireEvent.click(screen.getByRole("button", { name: "Add photo" }));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeImageFile("huge.png", MAX_PHOTO_SIZE_BYTES + 1);
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/too large/)).toBeInTheDocument();
    expect(mockUploadPhoto).not.toHaveBeenCalled();
  });

  it("rejects a non-image file before calling the upload action", async () => {
    renderModal();
    await getControls();

    fireEvent.click(screen.getByRole("button", { name: "Add photo" }));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeImageFile("notes.txt", 1024, "text/plain");
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/must be a/)).toBeInTheDocument();
    expect(mockUploadPhoto).not.toHaveBeenCalled();
  });

  it("shows a remove button once a photo exists, and removes it on click", async () => {
    mockGetHistory.mockResolvedValue({
      ok: true,
      entries: [{ ...baseEntry, photoUrl: "https://storage.example/photo.png" }],
    });
    mockRemovePhoto.mockResolvedValue({ ok: true });
    renderModal();
    await getControls();

    expect(await screen.findByAltText("Photo for entry 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(mockRemovePhoto).toHaveBeenCalledWith(cardId, square.id, "entry-1"));
    await waitFor(() => expect(screen.queryByAltText("Photo for entry 1")).not.toBeInTheDocument());
  });

  it("shows an error message when the upload action fails", async () => {
    mockUploadPhoto.mockResolvedValue({ ok: false, error: "Something went wrong. Try again." });
    renderModal();
    await getControls();

    fireEvent.click(screen.getByRole("button", { name: "Add photo" }));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [makeImageFile("photo.png", 1024)] } });

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
  });
});
