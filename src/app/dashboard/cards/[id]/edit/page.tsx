import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOwnedCardOrNotFound } from "@/lib/cards/access";
import { isValidGridSize } from "@/lib/cards/grid";
import { CardBuilder } from "../../_builder/card-builder";
import type { PositionedSquareDraft } from "../../_builder/positions";
import type { CardSettings } from "../../_builder/types";
import { deleteCard, updateCard } from "./actions";
import { DeleteCardButton } from "./delete-card-button";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await getOwnedCardOrNotFound(id);

  const initialSettings: CardSettings = {
    name: card.name,
    gridSize: isValidGridSize(card.gridSize) ? card.gridSize : 5,
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
      <h1 className="sr-only">Edit {card.name}</h1>
      <Link
        href="/dashboard"
        aria-label="Back to your cards"
        className="w-fit shrink-0 rounded-[var(--radius-sm)] p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
      </Link>
      <CardBuilder
        mode="edit"
        initialSettings={initialSettings}
        initialSquares={initialSquares}
        onSave={updateCard.bind(null, card.id)}
      />
      <DeleteCardButton onDelete={deleteCard.bind(null, card.id)} />
    </div>
  );
}
