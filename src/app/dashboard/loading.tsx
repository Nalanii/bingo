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
      <div
        aria-hidden="true"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="h-9 w-40 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
        <div className="h-11 w-32 animate-pulse rounded-full bg-muted" />
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-4 rounded-[var(--radius-lg)] border-2 border-border bg-card p-6"
          >
            <div className="h-6 w-2/3 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
            <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
            <div className="flex gap-2">
              <div className="h-9 flex-1 animate-pulse rounded-full bg-muted" />
              <div className="h-9 flex-1 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
