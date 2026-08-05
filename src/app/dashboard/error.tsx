"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

/**
 * Error boundary for the whole `/dashboard` segment — Next.js mounts this
 * automatically for the card list and every nested route (builder
 * create/edit, play grid), so an unhandled Firestore error anywhere in
 * those pages lands here instead of Next's generic error page.
 *
 * Never renders the raw `error.message` (it may contain Firestore/internal
 * details); it's only logged to the console.
 *
 * Retrying calls `router.refresh()` alongside `reset()`: Next's `reset()`
 * alone only clears the boundary's local error state and re-renders the
 * same already-errored Server Component payload — it does not re-fetch.
 * `router.refresh()` invalidates the Router Cache and re-requests the
 * segment from the server, which `reset()` then has a chance to render
 * successfully.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  useEffect(() => {
    console.error("Dashboard error boundary caught:", error);
  }, [error]);

  function handleRetry() {
    startRetry(() => {
      router.refresh();
      reset();
    });
  }

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
