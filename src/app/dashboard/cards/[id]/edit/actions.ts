"use server";

import { redirect } from "next/navigation";
import { getOwnedCard } from "@/lib/cards/access";
import {
  deleteCard as deleteCardDoc,
  updateCard as updateCardDoc,
  type Square,
} from "@/lib/firestore/cards";
import type { PositionedSquareDraft } from "../../_builder/positions";
import {
  validateSquareKindAndGoal,
  type CardSettings,
  type SaveCardResult,
} from "../../_builder/types";

/** Validates a builder draft and persists it as an update to an existing card. */
export async function updateCard(
  cardId: string,
  settings: CardSettings,
  squares: PositionedSquareDraft[],
): Promise<SaveCardResult> {
  const resolved = await getOwnedCard(cardId);
  if (!resolved.ok) return resolved;
  const { card } = resolved;

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

    const kindError = validateSquareKindAndGoal(square);
    if (kindError) {
      return { ok: false, error: kindError };
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
  const resolved = await getOwnedCard(cardId);
  if (!resolved.ok) return resolved;

  try {
    await deleteCardDoc(cardId);
  } catch (error) {
    console.error("deleteCard: failed to delete card", error);
    return { ok: false, error: "Something went wrong deleting your card. Try again." };
  }

  redirect("/dashboard");
}
