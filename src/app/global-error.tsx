"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort error boundary — Next.js mounts this only when the root
 * layout itself throws, so it replaces the whole document (`<html>` and
 * `<body>` included) instead of nesting inside `layout.tsx`. Everything
 * else (the marketing page, `/dashboard`, ...) is caught by the closer
 * `error.tsx` boundaries first; this one almost never renders.
 *
 * Kept deliberately simple: it can't lean on the app's fonts, providers, or
 * `components/ui` in case those are implicated in the crash. Never renders
 * the raw `error.message`; it's only logged to the console.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <span aria-hidden="true" className="text-5xl">
          😵
        </span>
        <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
        <p role="alert" className="text-muted-foreground">
          The app hit a snag. Try reloading the page.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error
            replaces the whole document, so it can't rely on the app router. */}
        <a
          href="/"
          className="bg-primary text-primary-foreground inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold shadow-[0_4px_0_0_rgba(0,0,0,0.15)] hover:-translate-y-0.5"
        >
          Go back home
        </a>
      </body>
    </html>
  );
}
