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
