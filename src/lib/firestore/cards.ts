import { db } from "@/lib/firebase/admin";

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

export interface CardSummary {
  id: string;
  name: string;
  gridSize: number;
  hasFreeSpace: boolean;
  layout: CardLayout;
  squareCount: number;
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
      squareCount: data.squares?.length ?? 0,
    };
  });
}
