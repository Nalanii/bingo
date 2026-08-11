import Link from "next/link";
import { getUser } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { BingoGlyph } from "@/lib/cards/bingo-mark";

/**
 * Shared header rendered on every page (landing, dashboard, card play view)
 * via the root layout. Adapts to auth state: signed-out visitors get the
 * wordmark plus a sign-in affordance, signed-in users get their email and a
 * sign-out control (the pre-existing dashboard header behavior).
 */
export async function SiteHeader() {
  const user = await getUser();

  return (
    <header className="sticky top-0 z-20 border-b-2 border-border bg-background/80 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3"
      >
        <Link
          href={user ? "/dashboard" : "/"}
          className="flex shrink-0 items-center gap-2 font-display text-xl font-bold"
        >
          <BingoGlyph size={28} />
          <span>
            <span className="text-primary-on-surface">B</span>
            <span className="text-secondary">i</span>
            <span className="text-success-on-surface">n</span>
            <span className="text-primary-on-surface">g</span>
            <span className="text-accent-on-surface">o</span>
            al
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          {user ? (
            <>
              <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <GoogleSignInButton size="sm" label="Sign in" />
          )}
        </div>
      </nav>
    </header>
  );
}
