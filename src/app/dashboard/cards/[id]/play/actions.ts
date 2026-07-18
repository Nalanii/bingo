"use server";

import { getUser } from "@/lib/auth";
import { getCard } from "@/lib/firestore/cards";
import { toggleCompletion } from "@/lib/firestore/completions";

export type ToggleCompletionResult =
  | { ok: true; completed: boolean }
  | { ok: false; error: string };

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
