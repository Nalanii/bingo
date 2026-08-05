import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Shape-matched loading skeleton for the card builder's first step
 * (`CardSettingsStep`), shared by the create (`cards/new`) and edit
 * (`cards/[id]/edit`) routes' `loading.tsx` files — both land on that step
 * first, so one skeleton covers both.
 */
export function BuilderSkeleton() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="h-4 w-32 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
        <Card>
          <CardHeader>
            <div className="h-6 w-48 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="h-4 w-24 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
              <div className="h-11 w-full animate-pulse rounded-[var(--radius-sm)] bg-muted" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-20 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
              <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-40 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-28 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
              <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
            </div>
            <div className="h-11 w-24 animate-pulse self-end rounded-full bg-muted" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
