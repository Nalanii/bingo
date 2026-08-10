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
        <div className="skeleton h-4 w-32 rounded-[var(--radius-sm)]" />
        <Card>
          <CardHeader>
            <div className="skeleton h-6 w-48 rounded-[var(--radius-sm)]" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="skeleton h-4 w-24 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-11 w-full rounded-[var(--radius-sm)]" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="skeleton h-4 w-20 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-11 w-full rounded-full" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="skeleton h-4 w-40 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-6 w-11 rounded-full" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="skeleton h-4 w-28 rounded-[var(--radius-sm)]" />
              <div className="skeleton h-11 w-full rounded-full" />
            </div>
            <div className="skeleton h-11 w-24 self-end rounded-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
