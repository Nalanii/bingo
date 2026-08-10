import { Card, CardContent } from "@/components/ui/card";

/**
 * Suspense fallback for the `/dashboard` card list, shown while
 * `listCardsByOwner`/`getCompletions` are in flight. Shape-matches the real
 * layout in `page.tsx` (title/button bar + a grid of card tiles) so there's
 * no layout shift once the real content arrives.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        Loading your cards…
      </p>
      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-3">
        <div className="skeleton h-9 w-40 rounded-[var(--radius-sm)]" />
        <div className="skeleton h-11 w-32 rounded-full" />
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="flex flex-col gap-4 py-6">
              <div className="skeleton h-6 w-2/3 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-4 w-1/3 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-2 w-full rounded-full" />
              <div className="flex gap-2">
                <div className="skeleton h-9 flex-1 rounded-full" />
                <div className="skeleton h-9 flex-1 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
