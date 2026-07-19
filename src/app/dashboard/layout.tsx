import Link from "next/link";
import { getUser } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b-2 border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/dashboard"
            className="shrink-0 font-display text-xl font-bold"
          >
            Bingoal
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:inline">
              {user?.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
