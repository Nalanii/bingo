"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Error boundary for the root segment — Next.js mounts this for the
 * marketing page and any other route outside `/dashboard`, so an unhandled
 * error there lands here instead of Next's generic error page. (Errors
 * thrown by the root layout itself skip this file and hit `global-error.tsx`
 * instead.)
 *
 * Never renders the raw `error.message` (it may contain internal details);
 * it's only logged to the console.
 *
 * Retrying calls `router.refresh()` alongside `reset()`: Next's `reset()`
 * alone only clears the boundary's local error state and re-renders the
 * same already-errored Server Component payload — it does not re-fetch.
 * `router.refresh()` invalidates the Router Cache and re-requests the
 * segment from the server, which `reset()` then has a chance to render
 * successfully.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  function handleRetry() {
    startRetry(() => {
      router.refresh();
      reset();
    });
  }

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
