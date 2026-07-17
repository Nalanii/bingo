import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

/** Gates everything under /dashboard behind a valid Firebase session cookie. */
export async function middleware(request: NextRequest) {
  const isPrivate = request.nextUrl.pathname.startsWith("/dashboard");
  if (!isPrivate) return NextResponse.next();

  const sessionCookie = request.cookies.get("session")?.value;
  let authenticated = false;

  if (sessionCookie) {
    try {
      await adminAuth.verifySessionCookie(sessionCookie);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("signin", "1");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  // Run on all paths except static assets and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
