"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useErrorBoundaryRetry } from "@/lib/use-error-boundary-retry";

/**
 * Error boundary for the whole `/dashboard` segment — Next.js mounts this
 * automatically for the card list and every nested route (builder
 * create/edit, play grid), so an unhandled Firestore error anywhere in
 * those pages lands here instead of Next's generic error page.
 *
 * See `useErrorBoundaryRetry` for the retry/logging behavior shared with
 * the root `error.tsx`.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const { isRetrying, handleRetry } = useErrorBoundaryRetry(
    error,
    reset,
    "Dashboard error boundary",
  );

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <span aria-hidden="true" className="text-5xl">
          😵
        </span>
        <div>
          <h1 className="sr-only">Something went wrong</h1>
          <CardTitle>Something went wrong</CardTitle>
          <p role="alert" className="text-muted-foreground mt-1">
            We hit a snag loading this page. Give it another try.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={handleRetry} disabled={isRetrying}>
            {isRetrying ? "Retrying…" : "Try again"}
          </Button>
          {pathname !== "/dashboard" && (
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Back to your cards
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
