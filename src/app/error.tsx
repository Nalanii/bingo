"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useErrorBoundaryRetry } from "@/lib/use-error-boundary-retry";

/**
 * Error boundary for the root segment — Next.js mounts this for the
 * marketing page and any other route outside `/dashboard`, so an unhandled
 * error there lands here instead of Next's generic error page. (Errors
 * thrown by the root layout itself skip this file and hit `global-error.tsx`
 * instead.)
 *
 * See `useErrorBoundaryRetry` for the retry/logging behavior shared with
 * `dashboard/error.tsx`.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { isRetrying, handleRetry } = useErrorBoundaryRetry(
    error,
    reset,
    "Root error boundary",
  );

  return (
    <main
      id="main-content"
      className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <span aria-hidden="true" className="text-5xl">
        😵
      </span>
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p role="alert" className="text-muted-foreground">
        We hit a snag loading this page. Give it another try.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={handleRetry} disabled={isRetrying}>
          {isRetrying ? "Retrying…" : "Try again"}
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Go back home
        </Link>
      </div>
    </main>
  );
}
