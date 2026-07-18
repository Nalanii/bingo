import type { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";

export interface Completion {
  id: string;
  squareId: string;
  completedAt: Date;
}

/** Reads all completion docs for a card. */
export async function getCompletions(cardId: string): Promise<Completion[]> {
  const snapshot = await db.collection("cards").doc(cardId).collection("completions").get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as { squareId: string; completedAt: Timestamp };
    return {
      id: doc.id,
      squareId: data.squareId,
      completedAt: data.completedAt.toDate(),
    };
  });
}

/** Toggles a square's completion: deletes an existing completion or creates a new one. Returns the resulting completed state. */
export async function toggleCompletion(cardId: string, squareId: string): Promise<boolean> {
  const completions = db.collection("cards").doc(cardId).collection("completions");
  const existing = await completions.where("squareId", "==", squareId).limit(1).get();

  if (!existing.empty) {
    await existing.docs[0].ref.delete();
    return false;
  }

  await completions.add({ squareId, completedAt: new Date() });
  return true;
}

/** Logs a new completion for a counter square. Returns the resulting completion count. */
export async function addCompletion(cardId: string, squareId: string): Promise<number> {
  const completions = db.collection("cards").doc(cardId).collection("completions");
  await completions.add({ squareId, completedAt: new Date() });
  const count = await completions.where("squareId", "==", squareId).count().get();
  return count.data().count;
}

/** Removes the most recent completion for a counter square. Returns the resulting completion count. */
export async function removeLatestCompletion(cardId: string, squareId: string): Promise<number> {
  const completions = db.collection("cards").doc(cardId).collection("completions");
  // Sorted in memory (rather than via `.orderBy`) so this doesn't need a
  // composite Firestore index; a square's completion count is small.
  const existing = await completions.where("squareId", "==", squareId).get();
  const sorted = existing.docs.sort(
    (a, b) =>
      (b.data().completedAt as Timestamp).toMillis() -
      (a.data().completedAt as Timestamp).toMillis(),
  );

  if (sorted.length > 0) {
    await sorted[0].ref.delete();
  }

  return Math.max(sorted.length - 1, 0);
}
