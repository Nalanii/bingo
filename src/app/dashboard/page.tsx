import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { listCardsByOwner } from "@/lib/firestore/cards";
import { getCompletions } from "@/lib/firestore/completions";
import { computeCardProgress } from "@/lib/cards/progress";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getUser();
  // getUser() is guaranteed by middleware, but the proxy's revocation check is
  // weaker than getUser()'s, so a revoked-but-unexpired cookie can still reach
  // here. Redirect defensively instead of silently rendering an empty state.
  if (!user) redirect("/");

  const cards = await listCardsByOwner(user.uid);
  const progressByCardId = Object.fromEntries(
    await Promise.all(
      cards.map(async (card) => {
        const completions = await getCompletions(card.id);
        return [card.id, computeCardProgress(card.gridSize, card.squares, completions)] as const;
      }),
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Your cards</h1>
        <Link href="/dashboard/cards/new" className={buttonVariants()}>
          + New card
        </Link>
      </div>

      {cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span aria-hidden="true" className="text-5xl">🎲</span>
            <div>
              <CardTitle>No cards yet</CardTitle>
              <p className="mt-1 text-muted-foreground">
                Make your first bingo card and start chasing that line.
              </p>
            </div>
            <Link href="/dashboard/cards/new" className={buttonVariants()}>
              Create a card
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const progress = progressByCardId[card.id];
            const percent =
              progress.totalCount === 0
                ? 0
                : Math.round((progress.completedCount / progress.totalCount) * 100);

            return (
              <Card key={card.id}>
                <CardContent className="flex flex-col gap-4 py-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="min-w-0 truncate">{card.name}</CardTitle>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {progress.hasBingo && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                            BINGO!
                          </span>
                        )}
                        {progress.isBlackout && (
                          <span className="rounded-full border-2 border-primary bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%] px-2 py-0.5 text-xs font-bold text-primary-foreground">
                            BLACKOUT!
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {card.gridSize}×{card.gridSize} · {card.squareCount} squares
                      {card.hasFreeSpace && (
                        <span
                          className="ml-1.5 inline-flex items-center gap-0.5"
                          aria-label="Has a free space"
                          title="Has a free space"
                        >
                          <span aria-hidden="true">⭐</span>
                        </span>
                      )}
                    </p>
                    <div className="flex flex-col gap-1">
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-success transition-[width]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {progress.completedCount}/{progress.totalCount} done
                        </p>
                        <Link
                          href={`/dashboard/cards/${card.id}/edit`}
                          aria-label={`Edit ${card.name}`}
                          className="-my-2 inline-flex min-h-11 items-center px-2 py-2 text-xs text-muted-foreground hover:underline"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/cards/${card.id}/play`}
                    aria-label={`Play ${card.name}`}
                    className={buttonVariants({
                      variant: "primary",
                      size: "md",
                      className: "w-full",
                    })}
                  >
                    Play
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
