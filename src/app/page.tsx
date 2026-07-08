import Link from "next/link";
import { getUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { MiniBingoPreview } from "@/components/mini-bingo-preview";

export default async function Home() {
  const user = await getUser();

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden">
      {/* playful background blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-accent/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 -right-24 h-72 w-72 rounded-full bg-secondary/30 blur-3xl"
      />

      <section className="z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        <div className="flex flex-col items-start gap-6 text-left">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-card px-4 py-1.5 text-sm font-bold">
            🎉 goal &amp; event bingo, made fun
          </span>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Turn your goals into a{" "}
            <span className="text-primary">B</span>
            <span className="text-secondary">I</span>
            <span className="text-success">N</span>
            <span className="text-primary">G</span>
            <span className="text-accent-foreground">O</span>.
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Build 3×3 or 5×5 cards for anything — a year of adventures, a reading
            challenge, a bucket list. Check squares off, count things up, and
            celebrate every line.
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
            Free to play. Sign in with Google, make as many cards as you want.
          </p>
        </div>

        <div className="flex justify-center md:justify-end">
          <MiniBingoPreview />
        </div>
      </section>

      <footer className="z-10 w-full border-t-2 border-border/60 py-6 text-center text-sm text-muted-foreground">
        Made for fun. Bingoal is a work in progress ✨
      </footer>
    </main>
  );
}
