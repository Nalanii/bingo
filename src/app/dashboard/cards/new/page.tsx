import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Placeholder for the card builder. The real multi-step builder (name, size,
 * free space, square entry, order) is tracked in the backlog.
 */
export default function NewCardPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        ← Back to your cards
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Build a new card 🚧</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-muted-foreground">
          <p>
            The card builder is coming soon. It will let you name your card, pick
            a size (3×3 or 5×5), toggle a free space, choose random or set order,
            and enter each square as a one-and-done check or a counter goal.
          </p>
          <p className="text-sm">
            Follow along in the project backlog — this is the next big milestone.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
