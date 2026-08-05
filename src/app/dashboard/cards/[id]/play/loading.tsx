const SKELETON_GRID_SIZE = 5;

/**
 * Suspense fallback for `/dashboard/cards/[id]/play`, shown while `getCard`
 * and `getCompletions` are in flight. The real grid size (3 or 5) isn't
 * known until the card loads, so this shows a 5×5 grid as a representative
 * default shape.
 */
export default function PlayCardLoading() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <p role="status" className="sr-only">
        Loading your card…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="h-4 w-32 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
        <div className="h-8 w-2/3 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
        <div
          className="mx-auto grid w-full max-w-xl gap-1.5 sm:gap-2 md:gap-3"
          style={{
            gridTemplateColumns: `repeat(${SKELETON_GRID_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: SKELETON_GRID_SIZE * SKELETON_GRID_SIZE }).map(
            (_, index) => (
              <div
                key={index}
                className="aspect-square animate-pulse rounded-[var(--radius-sm)] border-2 border-border bg-muted"
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
