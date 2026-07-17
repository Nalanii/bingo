"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

/** Signs out of Firebase Auth and clears the server session cookie. */
export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setLoading(true);
    const results = await Promise.allSettled([
      signOut(auth),
      fetch("/api/auth/session", { method: "DELETE" }),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Sign out failed", result.reason);
      }
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={loading}
    >
      Sign out
    </Button>
  );
}
