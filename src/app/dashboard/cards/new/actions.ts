"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { freeSpacePosition } from "@/lib/cards/grid";
import { createCard, type Square } from "@/lib/firestore/cards";
import type { PositionedSquareDraft } from "../_builder/positions";
import type { CardSettings, SaveCardResult } from "../_builder/types";

/** Validates a builder draft and persists it as a new card for the current user. */
export async function saveCard(
  settings: CardSettings,
  squares: PositionedSquareDraft[],
): Promise<SaveCardResult> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in to save a card." };
  }

  if (settings.gridSize !== 3 && settings.gridSize !== 5) {
    return { ok: false, error: "Invalid grid size." };
  }
  if (settings.layout !== "RANDOM" && settings.layout !== "SET") {
    return { ok: false, error: "Invalid layout." };
  }
  if (!settings.name.trim()) {
    return { ok: false, error: "Give your card a name." };
  }

  const total = settings.gridSize * settings.gridSize;
  const reservedPosition = settings.hasFreeSpace
    ? freeSpacePosition(settings.gridSize)
    : -1;
  const expectedCount = total - (settings.hasFreeSpace ? 1 : 0);

  if (squares.length !== expectedCount) {
    return { ok: false, error: "Square count doesn't match the grid size." };
  }

  const seenPositions = new Set<number>();

  for (const square of squares) {
    if (!square.label.trim()) {
      return { ok: false, error: "Every square needs a label." };
    }
    if (
      !Number.isInteger(square.position) ||
      square.position < 0 ||
      square.position >= total ||
      square.position === reservedPosition
    ) {
      return { ok: false, error: "Invalid square position." };
    }
    if (seenPositions.has(square.position)) {
      return { ok: false, error: "Duplicate square position." };
    }
    seenPositions.add(square.position);

    if (square.kind === "CHECK" && square.goal !== 1) {
      return { ok: false, error: "Check squares must have a goal of 1." };
    }
    if (square.kind === "COUNTER" && (!Number.isInteger(square.goal) || square.goal < 2)) {
      return { ok: false, error: "Counter squares need a goal of at least 2." };
    }
  }

  const builtSquares: Square[] = squares.map((square, index) => ({
    id: `sq-${index}`,
    position: square.position,
    label: square.label.trim(),
    kind: square.kind,
    goal: square.goal,
    isFreeSpace: false,
  }));

  if (settings.hasFreeSpace) {
    builtSquares.push({
      id: "free-space",
      position: reservedPosition,
      label: "Free space",
      kind: "CHECK",
      goal: 1,
      isFreeSpace: true,
    });
  }

  try {
    await createCard({
      ownerId: user.uid,
      name: settings.name.trim(),
      gridSize: settings.gridSize,
      hasFreeSpace: settings.hasFreeSpace,
      layout: settings.layout,
      squares: builtSquares,
    });
  } catch (error) {
    console.error("saveCard: failed to create card", error);
    return { ok: false, error: "Something went wrong saving your card. Try again." };
  }

  redirect("/dashboard");
}
