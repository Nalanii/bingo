import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { CardBuilder } from "../_builder/card-builder";
import { saveCard } from "./actions";

export default async function NewCardPage() {
  const user = await getUser();
  // getUser() is guaranteed by middleware, but the proxy's revocation check is
  // weaker than getUser()'s, so a revoked-but-unexpired cookie can still reach
  // here. Redirect defensively instead of silently rendering an empty state.
  if (!user) redirect("/");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        ← Back to your cards
      </Link>
      <CardBuilder mode="create" onSave={saveCard} />
    </div>
  );
}
