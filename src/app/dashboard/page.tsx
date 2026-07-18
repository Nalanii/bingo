import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { listCardsByOwner } from "@/lib/firestore/cards";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getUser();
  // getUser() is guaranteed by middleware, but the proxy's revocation check is
  // weaker than getUser()'s, so a revoked-but-unexpired cookie can still reach
  // here. Redirect defensively instead of silently rendering an empty state.
  if (!user) redirect("/");

  const cards = await listCardsByOwner(user.uid);

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
            <span className="text-5xl">🎲</span>
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
          {cards.map((card) => (
            <Card key={card.id}>
              <CardContent className="flex flex-col gap-4 py-6">
                <div className="flex flex-col gap-2">
                  <CardTitle>{card.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {card.gridSize}×{card.gridSize} · {card.squareCount} squares
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/cards/${card.id}/play`}
                    className={buttonVariants({ variant: "primary", size: "sm", className: "flex-1" })}
                  >
                    Play
                  </Link>
                  <Link
                    href={`/dashboard/cards/${card.id}/edit`}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1" })}
                  >
                    Edit
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
