import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { getOwnedCardOrNotFound } from "@/lib/cards/access";
import { countCompletionsBySquare } from "@/lib/cards/progress";
import { getCompletions } from "@/lib/firestore/completions";
import { BingoGrid } from "@/components/bingo-grid";
import { ExportImageButton } from "@/components/export-image-button";

export default async function CardGridPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await getOwnedCardOrNotFound(id);

  const completions = await getCompletions(id);
  const checkSquareIds = new Set(
    card.squares.filter((square) => square.kind === "CHECK").map((square) => square.id),
  );
  const completedSquareIds = completions
    .filter((completion) => checkSquareIds.has(completion.squareId))
    .map((completion) => completion.squareId);
  const initialCounts = countCompletionsBySquare(completions);
  const initialLatestCompletionDates = completions.reduce<Record<string, string>>(
    (latest, completion) => {
      const existing = latest[completion.squareId];
      if (!existing || completion.completedAt > new Date(existing)) {
        latest[completion.squareId] = completion.completedAt.toISOString();
      }
      return latest;
    },
    {},
  );

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          aria-label="Back to your cards"
          className="shrink-0 rounded-[var(--radius-sm)] p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="flex-1 font-display text-2xl font-bold sm:text-3xl">{card.name}</h1>
        <ExportImageButton cardId={card.id} cardName={card.name} />
        <Link
          href={`/dashboard/cards/${card.id}/edit`}
          aria-label={`Edit ${card.name}`}
          className="shrink-0 rounded-[var(--radius-sm)] p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pencil aria-hidden="true" className="size-5" />
        </Link>
      </div>
      <BingoGrid
        cardId={card.id}
        gridSize={card.gridSize}
        squares={card.squares}
        initialCompletedSquareIds={completedSquareIds}
        initialCounts={initialCounts}
        initialLatestCompletionDates={initialLatestCompletionDates}
      />
    </div>
  );
}
