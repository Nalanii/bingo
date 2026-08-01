import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <h1 className="font-display text-3xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">
        The page you&rsquo;re looking for doesn&rsquo;t exist.
      </p>
      <Link href="/" className={buttonVariants()}>
        Go back home
      </Link>
    </main>
  );
}
