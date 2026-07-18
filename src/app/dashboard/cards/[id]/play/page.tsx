import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getCard } from "@/lib/firestore/cards";
import { getCompletions } from "@/lib/firestore/completions";
import { BingoGrid } from "@/components/bingo-grid";

export default async function PlayCardPage({
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

  const completions = await getCompletions(id);
  const checkSquareIds = new Set(
    card.squares.filter((square) => square.kind === "CHECK").map((square) => square.id),
  );
  const completedSquareIds = completions
    .filter((completion) => checkSquareIds.has(completion.squareId))
    .map((completion) => completion.squareId);
  const initialCounts = completions.reduce<Record<string, number>>((counts, completion) => {
    counts[completion.squareId] = (counts[completion.squareId] ?? 0) + 1;
    return counts;
  }, {});
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
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        ← Back to your cards
      </Link>
      <h1 className="font-display text-3xl font-bold">{card.name}</h1>
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
