"use server";

import { getUser } from "@/lib/auth";
import { MAX_NOTE_LENGTH } from "@/lib/completion-notes";
import { ALLOWED_PHOTO_TYPES_LABEL, MAX_PHOTO_SIZE_BYTES, isAllowedPhotoType } from "@/lib/completion-photos";
import { getCard, type Square } from "@/lib/firestore/cards";
import {
  addCompletion,
  getCompletionCount,
  getCompletionsForSquare,
  getSortedCompletionDocs,
  removeLatestCompletion,
  toggleCompletion,
  updateCompletionDate,
  updateCompletionNote,
  updateCompletionPhoto,
  type Completion,
} from "@/lib/firestore/completions";
import {
  completionPhotoPath,
  deleteCompletionPhoto,
  getCompletionPhotoSignedUrl,
  uploadCompletionPhoto,
} from "@/lib/firebase/storage";

export type ToggleCompletionResult =
  | { ok: true; completed: boolean }
  | { ok: false; error: string };

export type CounterProgressResult = { ok: true; count: number } | { ok: false; error: string };

export type CompletionHistoryEntry = {
  id: string;
  completedAt: string;
  note?: string;
  photoUrl?: string;
};

export type CompletionHistoryResult =
  | { ok: true; entries: CompletionHistoryEntry[] }
  | { ok: false; error: string };

export type UpdateCompletionDateResult = { ok: true } | { ok: false; error: string };

export type UploadCompletionPhotoResult =
  | { ok: true; photoUrl: string }
  | { ok: false; error: string };

export type RemoveCompletionPhotoResult = { ok: true } | { ok: false; error: string };

/**
 * Resolves and validates a square on a card the current user owns, or an
 * error. `getUser` and `getCard` don't depend on each other, so they run
 * concurrently rather than as two sequential round-trips.
 */
async function getOwnedSquare(
  cardId: string,
  squareId: string,
): Promise<{ ok: true; square: Square } | { ok: false; error: string }> {
  const [user, card] = await Promise.all([getUser(), getCard(cardId)]);

  if (!user) {
    return { ok: false, error: "You need to sign in to update a card." };
  }

  if (!card || card.ownerId !== user.uid) {
    return { ok: false, error: "Card not found." };
  }

  const square = card.squares.find((square) => square.id === squareId);
  if (!square) {
    return { ok: false, error: "Square not found." };
  }

  return { ok: true, square };
}

/** Toggles a CHECK square's completion for a card the current user owns. */
export async function toggleSquareCompletion(
  cardId: string,
  squareId: string,
): Promise<ToggleCompletionResult> {
  const resolved = await getOwnedSquare(cardId, squareId);
  if (!resolved.ok) return resolved;

  if (resolved.square.kind !== "CHECK") {
    return { ok: false, error: "Only check squares can be toggled this way." };
  }

  try {
    const existing = await getCompletionsForSquare(cardId, squareId);
    const completed = await toggleCompletion(cardId, squareId);

    if (!completed && existing[0]?.photoPath) {
      await deleteCompletionPhoto(existing[0].photoPath);
    }

    return { ok: true, completed };
  } catch (error) {
    console.error("toggleSquareCompletion: failed to toggle completion", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Resolves and validates a COUNTER square the current user owns, or an error. */
async function getOwnedCounterSquare(
  cardId: string,
  squareId: string,
): Promise<{ ok: true; square: Square } | { ok: false; error: string }> {
  const resolved = await getOwnedSquare(cardId, squareId);
  if (!resolved.ok) return resolved;

  if (resolved.square.kind !== "COUNTER") {
    return { ok: false, error: "Only counter squares can be incremented or decremented." };
  }

  return resolved;
}

/** Logs a Completion for a COUNTER square, incrementing its progress. */
export async function incrementSquareProgress(
  cardId: string,
  squareId: string,
): Promise<CounterProgressResult> {
  const resolved = await getOwnedCounterSquare(cardId, squareId);
  if (!resolved.ok) return resolved;

  try {
    const currentCount = await getCompletionCount(cardId, squareId);
    if (currentCount >= resolved.square.goal) {
      return { ok: false, error: "Goal already reached." };
    }

    const count = await addCompletion(cardId, squareId, currentCount);
    return { ok: true, count };
  } catch (error) {
    console.error("incrementSquareProgress: failed to add completion", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Removes the most recent Completion for a COUNTER square, decrementing its progress. */
export async function decrementSquareProgress(
  cardId: string,
  squareId: string,
): Promise<CounterProgressResult> {
  const resolved = await getOwnedCounterSquare(cardId, squareId);
  if (!resolved.ok) return resolved;

  try {
    const sorted = await getSortedCompletionDocs(cardId, squareId);
    if (sorted.length <= 0) {
      return { ok: false, error: "No progress to remove yet." };
    }

    const removedPhotoPath = sorted[0].data().photoPath as string | undefined;
    const count = await removeLatestCompletion(sorted);

    if (removedPhotoPath) {
      await deleteCompletionPhoto(removedPhotoPath);
    }

    return { ok: true, count };
  } catch (error) {
    console.error("decrementSquareProgress: failed to remove completion", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Reads a square's completion history for a card the current user owns. */
export async function getSquareCompletionHistory(
  cardId: string,
  squareId: string,
): Promise<CompletionHistoryResult> {
  const resolved = await getOwnedSquare(cardId, squareId);
  if (!resolved.ok) return resolved;

  try {
    const completions = await getCompletionsForSquare(cardId, squareId);
    const entries = await Promise.all(
      completions.map(async (completion) => ({
        id: completion.id,
        completedAt: completion.completedAt.toISOString(),
        note: completion.note,
        photoUrl: completion.photoPath
          ? await getCompletionPhotoSignedUrl(completion.photoPath)
          : undefined,
      })),
    );
    return { ok: true, entries };
  } catch (error) {
    console.error("getSquareCompletionHistory: failed to read completion history", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Updates the completed-at date of a single completion for a square the current user owns. */
export async function updateSquareCompletionDate(
  cardId: string,
  squareId: string,
  completionId: string,
  completedAt: string,
): Promise<UpdateCompletionDateResult> {
  const resolved = await getOwnedSquare(cardId, squareId);
  if (!resolved.ok) return resolved;

  const date = new Date(completedAt);
  if (isNaN(date.getTime())) {
    return { ok: false, error: "Enter a valid date." };
  }
  if (date.getTime() > Date.now()) {
    return { ok: false, error: "Completion date can't be in the future." };
  }

  try {
    const completions = await getCompletionsForSquare(cardId, squareId);
    if (!completions.some((completion) => completion.id === completionId)) {
      return { ok: false, error: "Completion not found." };
    }

    await updateCompletionDate(cardId, completionId, date);
    return { ok: true };
  } catch (error) {
    console.error("updateSquareCompletionDate: failed to update completion date", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Updates or clears the note on a single completion for a square the current user owns. */
export async function updateSquareCompletionNote(
  cardId: string,
  squareId: string,
  completionId: string,
  note: string,
): Promise<UpdateCompletionDateResult> {
  const resolved = await getOwnedSquare(cardId, squareId);
  if (!resolved.ok) return resolved;

  const trimmed = note.trim();
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `Note is too long (max ${MAX_NOTE_LENGTH} characters).` };
  }

  try {
    const completions = await getCompletionsForSquare(cardId, squareId);
    if (!completions.some((completion) => completion.id === completionId)) {
      return { ok: false, error: "Completion not found." };
    }

    await updateCompletionNote(cardId, completionId, trimmed.length > 0 ? trimmed : null);
    return { ok: true };
  } catch (error) {
    console.error("updateSquareCompletionNote: failed to update completion note", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Resolves a single completion by id for a square the caller already owns, or an error. */
async function getOwnedCompletion(
  cardId: string,
  squareId: string,
  completionId: string,
): Promise<{ ok: true; completion: Completion } | { ok: false; error: string }> {
  const completions = await getCompletionsForSquare(cardId, squareId);
  const completion = completions.find((completion) => completion.id === completionId);
  if (!completion) {
    return { ok: false, error: "Completion not found." };
  }
  return { ok: true, completion };
}

/** Uploads (or replaces) the photo on a single completion for a square the current user owns. */
export async function uploadSquareCompletionPhoto(
  cardId: string,
  squareId: string,
  completionId: string,
  formData: FormData,
): Promise<UploadCompletionPhotoResult> {
  const resolved = await getOwnedSquare(cardId, squareId);
  if (!resolved.ok) return resolved;

  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return { ok: false, error: "No photo was provided." };
  }
  if (!isAllowedPhotoType(file.type)) {
    return { ok: false, error: `Photo must be a ${ALLOWED_PHOTO_TYPES_LABEL} image.` };
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return {
      ok: false,
      error: `Photo is too large (max ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB).`,
    };
  }

  try {
    const resolvedCompletion = await getOwnedCompletion(cardId, squareId, completionId);
    if (!resolvedCompletion.ok) return resolvedCompletion;
    const { completion: existing } = resolvedCompletion;

    const buffer = Buffer.from(await file.arrayBuffer());
    const path = completionPhotoPath(cardId, completionId, file.type);
    await uploadCompletionPhoto(path, buffer, file.type);
    await updateCompletionPhoto(cardId, completionId, path);

    if (existing.photoPath && existing.photoPath !== path) {
      await deleteCompletionPhoto(existing.photoPath);
    }

    const photoUrl = await getCompletionPhotoSignedUrl(path);
    return { ok: true, photoUrl };
  } catch (error) {
    console.error("uploadSquareCompletionPhoto: failed to upload photo", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Removes the photo from a single completion for a square the current user owns. */
export async function removeSquareCompletionPhoto(
  cardId: string,
  squareId: string,
  completionId: string,
): Promise<RemoveCompletionPhotoResult> {
  const resolved = await getOwnedSquare(cardId, squareId);
  if (!resolved.ok) return resolved;

  try {
    const resolvedCompletion = await getOwnedCompletion(cardId, squareId, completionId);
    if (!resolvedCompletion.ok) return resolvedCompletion;
    const { completion: existing } = resolvedCompletion;

    if (existing.photoPath) {
      await deleteCompletionPhoto(existing.photoPath);
    }
    await updateCompletionPhoto(cardId, completionId, null);
    return { ok: true };
  } catch (error) {
    console.error("removeSquareCompletionPhoto: failed to remove photo", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
