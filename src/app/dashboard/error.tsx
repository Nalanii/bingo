"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error("Dashboard error boundary caught:", error);
  }, [error]);

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <span aria-hidden="true" className="text-5xl">
          😵
        </span>
        <div>
          <CardTitle>Something went wrong</CardTitle>
          <p role="alert" className="mt-1 text-muted-foreground">
            We hit a snag loading this page. Give it another try.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}>
            Try again
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
