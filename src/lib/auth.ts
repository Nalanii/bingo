import { cache } from "react";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Returns the currently authenticated user from the session cookie, or null.
 *
 * Wrapped in React's `cache()` so multiple calls within the same request
 * (e.g. a layout and the page it wraps) dedupe to a single
 * `verifySessionCookie` round-trip instead of one each.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) return null;

  try {
    const claims = await adminAuth.verifySessionCookie(sessionCookie, true);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      displayName: typeof claims.name === "string" ? claims.name : null,
      avatarUrl: claims.picture ?? null,
    };
  } catch (error) {
    // Expired, revoked, or malformed cookie — or a misconfigured Admin SDK.
    // Log so credential/config issues are visible in server logs rather than
    // silently manifesting as "every user appears logged out."
    console.error("getUser: session cookie verification failed", error);
    return null;
  }
});
