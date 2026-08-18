import { db } from "@/lib/firebase/admin";
import { getCompletions } from "@/lib/firestore/completions";
import { deleteCompletionPhoto } from "@/lib/firebase/storage";

export type SquareKind = "CHECK" | "COUNTER";
export type CardLayout = "RANDOM" | "SET";

export interface Square {
  id: string;
  position: number;
  label: string;
  kind: SquareKind;
  goal: number;
  isFreeSpace: boolean;
}

export interface Card {
  id: string;
  ownerId: string;
  name: string;
  gridSize: number;
  hasFreeSpace: boolean;
  layout: CardLayout;
  squares: Square[];
}

export interface CardSummary {
  id: string;
  name: string;
  gridSize: number;
  hasFreeSpace: boolean;
  layout: CardLayout;
  squares: Square[];
}

export interface CreateCardInput {
  ownerId: string;
  name: string;
  gridSize: number;
  hasFreeSpace: boolean;
  layout: CardLayout;
  squares: Square[];
}

export interface UpdateCardInput {
  name: string;
  layout: CardLayout;
  squares: Square[];
}

/** Creates a new card doc and returns its generated id. */
export async function createCard(input: CreateCardInput): Promise<string> {
  const now = new Date();
  const ref = db.collection("cards").doc();

  await ref.set({
    ownerId: input.ownerId,
    name: input.name,
    gridSize: input.gridSize,
    hasFreeSpace: input.hasFreeSpace,
    layout: input.layout,
    squares: input.squares,
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

/** Fetches a full card doc by id, or null if it doesn't exist. */
export async function getCard(cardId: string): Promise<Card | null> {
  const doc = await db.collection("cards").doc(cardId).get();
  if (!doc.exists) return null;

  const data = doc.data() as {
    ownerId: string;
    name: string;
    gridSize: number;
    hasFreeSpace: boolean;
    layout: CardLayout;
    squares: Square[];
  };

  return {
    id: doc.id,
    ownerId: data.ownerId,
    name: data.name,
    gridSize: data.gridSize,
    hasFreeSpace: data.hasFreeSpace,
    layout: data.layout,
    squares: data.squares,
  };
}

/** Updates a card's editable fields (name, layout, squares) and bumps updatedAt. */
export async function updateCard(
  cardId: string,
  input: UpdateCardInput,
): Promise<void> {
  await db.collection("cards").doc(cardId).update({
    name: input.name,
    layout: input.layout,
    squares: input.squares,
    updatedAt: new Date(),
  });
}

/**
 * Deletes a card doc along with its completions subcollection, since Firestore
 * doesn't cascade-delete subcollections on its own. Any completion photos in
 * Storage are deleted first so they don't leak once the docs referencing them
 * are gone.
 */
export async function deleteCard(cardId: string): Promise<void> {
  const completions = await getCompletions(cardId);

  await Promise.all(
    completions
      .filter((completion) => completion.photoPath !== undefined)
      .map((completion) => deleteCompletionPhoto(completion.photoPath as string)),
  );

  const batch = db.batch();
  const cardRef = db.collection("cards").doc(cardId);
  completions.forEach((completion) => batch.delete(cardRef.collection("completions").doc(completion.id)));
  batch.delete(cardRef);

  await batch.commit();
}

/** Lists a user's cards, newest-updated first, with each card's square count. */
export async function listCardsByOwner(ownerId: string): Promise<CardSummary[]> {
  // Requires a Firestore composite index on cards (ownerId ASC, updatedAt DESC); see firestore.indexes.json.
  const snapshot = await db
    .collection("cards")
    .where("ownerId", "==", ownerId)
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as {
      name: string;
      gridSize: number;
      hasFreeSpace: boolean;
      layout: CardLayout;
      squares: Square[];
    };

    return {
      id: doc.id,
      name: data.name,
      gridSize: data.gridSize,
      hasFreeSpace: data.hasFreeSpace,
      layout: data.layout,
      squares: data.squares ?? [],
    };
  });
}
