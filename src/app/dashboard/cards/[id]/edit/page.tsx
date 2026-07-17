import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getCard } from "@/lib/firestore/cards";
import { CardBuilder } from "../../_builder/card-builder";
import type { PositionedSquareDraft } from "../../_builder/positions";
import type { CardSettings } from "../../_builder/types";
import { updateCard } from "./actions";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/");

  const card = await getCard(id);
  // notFound() for both "doesn't exist" and "not yours" so a guessed id
  // can't be used to confirm another user's card exists.
  if (!card || card.ownerId !== user.uid) notFound();

  const initialSettings: CardSettings = {
    name: card.name,
    gridSize: card.gridSize === 3 ? 3 : 5,
    hasFreeSpace: card.hasFreeSpace,
    layout: card.layout,
  };

  const initialSquares: PositionedSquareDraft[] = card.squares
    .filter((square) => !square.isFreeSpace)
    .sort((a, b) => a.position - b.position)
    .map((square) => ({
      label: square.label,
      kind: square.kind,
      goal: square.goal,
      position: square.position,
    }));

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        ← Back to your cards
      </Link>
      <CardBuilder
        mode="edit"
        initialSettings={initialSettings}
        initialSquares={initialSquares}
        onSave={updateCard.bind(null, card.id)}
      />
    </div>
  );
}
