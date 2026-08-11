import Link from "next/link";
import { getUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { MiniBingoPreview } from "@/components/mini-bingo-preview";

export default async function Home() {
  const user = await getUser();

  return (
    <main id="main-content" className="relative z-10 flex flex-1 flex-col items-center">
      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        <div className="flex flex-col items-start gap-6 text-left">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-accent px-4 py-1.5 text-sm font-bold text-accent-foreground">
            <span aria-hidden="true">🎉</span> Goal &amp; event bingo, made easy
          </span>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Turn anything into a{" "}
            <span className="text-primary-on-surface">B</span>
            <span className="text-secondary">I</span>
            <span className="text-success-on-surface">N</span>
            <span className="text-primary-on-surface">G</span>
            <span className="text-accent-on-surface">O</span>.
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Build a 3×3 or 5×5 card for anything you&apos;re chasing — a
            reading list, a bucket list, a year of adventures. Check squares
            off, count reps up, celebrate every line.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {user ? (
              <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
                Go to your cards →
              </Link>
            ) : (
              <GoogleSignInButton size="lg" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Free to play — sign in with Google, make as many cards as you
            like.
          </p>
        </div>

        <div className="flex justify-center md:justify-end">
          <MiniBingoPreview />
        </div>
      </section>
    </main>
  );
}
