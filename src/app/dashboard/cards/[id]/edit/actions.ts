"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import {
  deleteCard as deleteCardDoc,
  getCard,
  updateCard as updateCardDoc,
  type Square,
} from "@/lib/firestore/cards";
import type { PositionedSquareDraft } from "../../_builder/positions";
import type { CardSettings, SaveCardResult } from "../../_builder/types";

/** Validates a builder draft and persists it as an update to an existing card. */
export async function updateCard(
  cardId: string,
  settings: CardSettings,
  squares: PositionedSquareDraft[],
): Promise<SaveCardResult> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in to save a card." };
  }

  const card = await getCard(cardId);
  if (!card || card.ownerId !== user.uid) {
    return { ok: false, error: "Card not found." };
  }

  if (settings.layout !== "RANDOM" && settings.layout !== "SET") {
    return { ok: false, error: "Invalid layout." };
  }
  if (!settings.name.trim()) {
    return { ok: false, error: "Give your card a name." };
  }

  const existingSquares = card.squares.filter((square) => !square.isFreeSpace);
  const existingPositions = new Set(
    existingSquares.map((square) => square.position),
  );

  if (squares.length !== existingSquares.length) {
    return { ok: false, error: "Square layout doesn't match this card." };
  }

  const seenPositions = new Set<number>();

  for (const square of squares) {
    if (!square.label.trim()) {
      return { ok: false, error: "Every square needs a label." };
    }
    if (!existingPositions.has(square.position)) {
      return { ok: false, error: "Square layout doesn't match this card." };
    }
    if (seenPositions.has(square.position)) {
      return { ok: false, error: "Duplicate square position." };
    }
    seenPositions.add(square.position);

    if (square.kind !== "CHECK" && square.kind !== "COUNTER") {
      return { ok: false, error: "Invalid square type." };
    }
    if (square.kind === "CHECK" && square.goal !== 1) {
      return { ok: false, error: "Check squares must have a goal of 1." };
    }
    if (square.kind === "COUNTER" && (!Number.isInteger(square.goal) || square.goal < 2)) {
      return { ok: false, error: "Counter squares need a goal of at least 2." };
    }
  }

  const existingByPosition = new Map(
    existingSquares.map((square) => [square.position, square]),
  );

  const updatedSquares: Square[] = squares.map((square) => {
    // existingByPosition is guaranteed to have an entry here — every
    // square.position was checked against existingPositions above.
    const existing = existingByPosition.get(square.position)!;
    return {
      id: existing.id,
      position: square.position,
      label: square.label.trim(),
      kind: square.kind,
      goal: square.goal,
      isFreeSpace: false,
    };
  });

  const freeSpaceSquare = card.squares.find((square) => square.isFreeSpace);
  if (freeSpaceSquare) {
    updatedSquares.push(freeSpaceSquare);
  }

  try {
    await updateCardDoc(cardId, {
      name: settings.name.trim(),
      layout: settings.layout,
      squares: updatedSquares,
    });
  } catch (error) {
    console.error("updateCard: failed to update card", error);
    return { ok: false, error: "Something went wrong saving your card. Try again." };
  }

  redirect("/dashboard");
}

/** Deletes a card the current user owns. */
export async function deleteCard(cardId: string): Promise<SaveCardResult> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in to delete a card." };
  }

  const card = await getCard(cardId);
  if (!card || card.ownerId !== user.uid) {
    return { ok: false, error: "Card not found." };
  }

  try {
    await deleteCardDoc(cardId);
  } catch (error) {
    console.error("deleteCard: failed to delete card", error);
    return { ok: false, error: "Something went wrong deleting your card. Try again." };
  }

  redirect("/dashboard");
}
