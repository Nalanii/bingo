import Link from "next/link";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getUser();
  // getUser() is guaranteed by middleware, but keep types honest.
  const cards = user
    ? await prisma.card.findMany({
        where: { ownerId: user.id },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { squares: true } } },
      })
    : [];

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
              <CardContent className="flex flex-col gap-2 py-6">
                <CardTitle>{card.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {card.gridSize}×{card.gridSize} · {card._count.squares} squares
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
