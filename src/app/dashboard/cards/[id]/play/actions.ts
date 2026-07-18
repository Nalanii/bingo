"use server";

import { getUser } from "@/lib/auth";
import { getCard, type Square } from "@/lib/firestore/cards";
import {
  addCompletion,
  getCompletions,
  getCompletionsForSquare,
  removeLatestCompletion,
  toggleCompletion,
  updateCompletionDate,
} from "@/lib/firestore/completions";

export type ToggleCompletionResult =
  | { ok: true; completed: boolean }
  | { ok: false; error: string };

export type CounterProgressResult = { ok: true; count: number } | { ok: false; error: string };

export type CompletionHistoryEntry = { id: string; completedAt: string };

export type CompletionHistoryResult =
  | { ok: true; entries: CompletionHistoryEntry[] }
  | { ok: false; error: string };

export type UpdateCompletionDateResult = { ok: true } | { ok: false; error: string };

/** Toggles a CHECK square's completion for a card the current user owns. */
export async function toggleSquareCompletion(
  cardId: string,
  squareId: string,
): Promise<ToggleCompletionResult> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in to update a card." };
  }

  const card = await getCard(cardId);
  if (!card || card.ownerId !== user.uid) {
    return { ok: false, error: "Card not found." };
  }

  const square = card.squares.find((square) => square.id === squareId);
  if (!square) {
    return { ok: false, error: "Square not found." };
  }

  if (square.kind !== "CHECK") {
    return { ok: false, error: "Only check squares can be toggled this way." };
  }

  try {
    const completed = await toggleCompletion(cardId, squareId);
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
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in to update a card." };
  }

  const card = await getCard(cardId);
  if (!card || card.ownerId !== user.uid) {
    return { ok: false, error: "Card not found." };
  }

  const square = card.squares.find((square) => square.id === squareId);
  if (!square) {
    return { ok: false, error: "Square not found." };
  }

  if (square.kind !== "COUNTER") {
    return { ok: false, error: "Only counter squares can be incremented or decremented." };
  }

  return { ok: true, square };
}

/** Logs a Completion for a COUNTER square, incrementing its progress. */
export async function incrementSquareProgress(
  cardId: string,
  squareId: string,
): Promise<CounterProgressResult> {
  const resolved = await getOwnedCounterSquare(cardId, squareId);
  if (!resolved.ok) return resolved;

  try {
    const completions = await getCompletions(cardId);
    const currentCount = completions.filter(
      (completion) => completion.squareId === squareId,
    ).length;
    if (currentCount >= resolved.square.goal) {
      return { ok: false, error: "Goal already reached." };
    }

    const count = await addCompletion(cardId, squareId);
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
    const completions = await getCompletions(cardId);
    const currentCount = completions.filter(
      (completion) => completion.squareId === squareId,
    ).length;
    if (currentCount <= 0) {
      return { ok: false, error: "No progress to remove yet." };
    }

    const count = await removeLatestCompletion(cardId, squareId);
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
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in to update a card." };
  }

  const card = await getCard(cardId);
  if (!card || card.ownerId !== user.uid) {
    return { ok: false, error: "Card not found." };
  }

  const square = card.squares.find((square) => square.id === squareId);
  if (!square) {
    return { ok: false, error: "Square not found." };
  }

  try {
    const completions = await getCompletionsForSquare(cardId, squareId);
    const entries = completions.map((completion) => ({
      id: completion.id,
      completedAt: completion.completedAt.toISOString(),
    }));
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
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in to update a card." };
  }

  const card = await getCard(cardId);
  if (!card || card.ownerId !== user.uid) {
    return { ok: false, error: "Card not found." };
  }

  const square = card.squares.find((square) => square.id === squareId);
  if (!square) {
    return { ok: false, error: "Square not found." };
  }

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
