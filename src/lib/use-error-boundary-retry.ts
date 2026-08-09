"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Shared retry/logging logic for route-level error boundaries.
 *
 * Retrying calls `router.refresh()` alongside `reset()`: Next's `reset()`
 * alone only clears the boundary's local error state and re-renders the
 * same already-errored Server Component payload — it does not re-fetch.
 * `router.refresh()` invalidates the Router Cache and re-requests the
 * segment from the server, which `reset()` then has a chance to render
 * successfully.
 *
 * Never renders the raw `error.message` (it may contain internal details);
 * it's only logged to the console.
 */
export function useErrorBoundaryRetry(
  error: Error & { digest?: string },
  reset: () => void,
  logLabel: string,
) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  useEffect(() => {
    console.error(`${logLabel} caught:`, error);
  }, [error, logLabel]);

  function handleRetry() {
    startRetry(() => {
      router.refresh();
      reset();
    });
  }

  return { isRetrying, handleRetry };
}
