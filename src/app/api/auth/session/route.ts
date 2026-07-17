import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { upsertProfile } from "@/lib/firestore/profiles";

const SESSION_COOKIE_NAME = "session";
const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks

/**
 * Exchanges a Firebase ID token for an HTTP-only session cookie, and upserts
 * the user's profile doc. Called by the client right after Google sign-in.
 */
export async function POST(request: Request) {
  let idToken: string | undefined;
  try {
    ({ idToken } = (await request.json()) as { idToken?: string });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  let decoded;
  let sessionCookie;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });
  } catch (error) {
    console.error("session route: failed to verify/exchange idToken", error);
    return NextResponse.json({ error: "Invalid or expired idToken" }, { status: 401 });
  }

  await upsertProfile({
    uid: decoded.uid,
    email: decoded.email ?? null,
    displayName: typeof decoded.name === "string" ? decoded.name : null,
    avatarUrl: decoded.picture ?? null,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRES_IN_MS / 1000,
  });

  return NextResponse.json({ ok: true });
}

/** Clears the session cookie and revokes the user's refresh tokens. */
export async function DELETE() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const claims = await adminAuth.verifySessionCookie(sessionCookie);
      await adminAuth.revokeRefreshTokens(claims.uid);
    } catch {
      // Already invalid/expired — nothing to revoke.
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
