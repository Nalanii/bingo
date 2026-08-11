import { PageTransition } from "@/components/page-transition";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
