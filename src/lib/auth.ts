import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Returns the currently authenticated user from the session cookie, or null. */
export async function getUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) return null;

  try {
    const claims = await adminAuth.verifySessionCookie(sessionCookie, true);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      displayName: (claims.name as string | undefined) ?? null,
      avatarUrl: (claims.picture as string | undefined) ?? null,
    };
  } catch {
    // Expired, revoked, or malformed cookie.
    return null;
  }
}
