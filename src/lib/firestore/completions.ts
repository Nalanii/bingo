import type { QueryDocumentSnapshot, Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";

export interface Completion {
  id: string;
  squareId: string;
  completedAt: Date;
}

function toCompletion(doc: QueryDocumentSnapshot): Completion {
  const data = doc.data() as { squareId: string; completedAt: Timestamp };
  return {
    id: doc.id,
    squareId: data.squareId,
    completedAt: data.completedAt.toDate(),
  };
}

/**
 * Reads completion docs for a single square, sorted in memory (rather than
 * via `.orderBy`) so this doesn't need a composite Firestore index — a
 * square's completion count is small.
 */
export async function getSortedCompletionDocs(
  cardId: string,
  squareId: string,
): Promise<QueryDocumentSnapshot[]> {
  const completions = db.collection("cards").doc(cardId).collection("completions");
  const existing = await completions.where("squareId", "==", squareId).get();
  return existing.docs.sort(
    (a, b) =>
      (b.data().completedAt as Timestamp).toMillis() -
      (a.data().completedAt as Timestamp).toMillis(),
  );
}

/** Reads all completion docs for a card. */
export async function getCompletions(cardId: string): Promise<Completion[]> {
  const snapshot = await db.collection("cards").doc(cardId).collection("completions").get();
  return snapshot.docs.map(toCompletion);
}

/** Counts a single square's completions without downloading the docs. */
export async function getCompletionCount(cardId: string, squareId: string): Promise<number> {
  const completions = db.collection("cards").doc(cardId).collection("completions");
  const count = await completions.where("squareId", "==", squareId).count().get();
  return count.data().count;
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

/**
 * Logs a new completion for a counter square. Returns the resulting
 * completion count, derived from `currentCount` rather than re-querying.
 */
export async function addCompletion(
  cardId: string,
  squareId: string,
  currentCount: number,
): Promise<number> {
  const completions = db.collection("cards").doc(cardId).collection("completions");
  await completions.add({ squareId, completedAt: new Date() });
  return currentCount + 1;
}

/**
 * Removes the most recent completion for a counter square, given the docs
 * the caller already fetched via `getSortedCompletionDocs`. Returns the
 * resulting completion count.
 */
export async function removeLatestCompletion(
  sorted: QueryDocumentSnapshot[],
): Promise<number> {
  if (sorted.length > 0) {
    await sorted[0].ref.delete();
  }

  return Math.max(sorted.length - 1, 0);
}

/** Reads all completion docs for a single square, sorted by completedAt descending (most recent first). */
export async function getCompletionsForSquare(
  cardId: string,
  squareId: string,
): Promise<Completion[]> {
  const sorted = await getSortedCompletionDocs(cardId, squareId);
  return sorted.map(toCompletion);
}

/** Updates the completedAt date of a single completion doc. */
export async function updateCompletionDate(
  cardId: string,
  completionId: string,
  completedAt: Date,
): Promise<void> {
  await db
    .collection("cards")
    .doc(cardId)
    .collection("completions")
    .doc(completionId)
    .update({ completedAt });
}
