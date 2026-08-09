import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getCard, type Card } from "@/lib/firestore/cards";

/**
 * Resolves the current user's owned card for a Server Component page, or
 * redirects/404s. `getUser` and `getCard` don't depend on each other, so
 * they run concurrently rather than as two sequential round-trips.
 *
 * Unauthenticated visitors redirect to `/`. A missing card and a card owned
 * by someone else both 404, so a guessed id can't be used to confirm
 * another user's card exists.
 */
export async function getOwnedCardOrNotFound(cardId: string): Promise<Card> {
  const [user, card] = await Promise.all([getUser(), getCard(cardId)]);
  if (!user) redirect("/");
  if (!card || card.ownerId !== user.uid) notFound();

  return card;
}

export type OwnedCardResult = { ok: true; card: Card } | { ok: false; error: string };

/**
 * Resolves the current user's owned card for a Server Action, or an error
 * the caller can branch on. `getUser` and `getCard` don't depend on each
 * other, so they run concurrently rather than as two sequential round-trips.
 */
export async function getOwnedCard(cardId: string): Promise<OwnedCardResult> {
  const [user, card] = await Promise.all([getUser(), getCard(cardId)]);
  if (!user) {
    return { ok: false, error: "You need to sign in to do that." };
  }

  if (!card || card.ownerId !== user.uid) {
    return { ok: false, error: "Card not found." };
  }

  return { ok: true, card };
}
