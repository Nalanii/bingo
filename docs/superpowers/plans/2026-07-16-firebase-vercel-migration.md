# Firebase + Vercel Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase (Auth + Postgres/Prisma) with Firebase Auth (Google-only) and Firestore, keeping Next.js hosted on Vercel with no Fly.io dependency.

**Architecture:** Firebase Auth issues an ID token on Google sign-in; a route handler exchanges it for an HTTP-only session cookie via the Admin SDK. `src/middleware.ts` (Node.js runtime) verifies that cookie to gate `/dashboard/*`. All Firestore reads/writes happen server-side through the Admin SDK from Server Components/Route Handlers — no client Firestore SDK usage.

**Tech Stack:** Next.js 16 (App Router), `firebase` (client SDK), `firebase-admin` (server SDK), Firestore, Vercel.

**Reference spec:** `docs/superpowers/specs/2026-07-16-firebase-vercel-migration-design.md`

**Note on scope vs. spec:** The spec's file list mentions a `completions.ts` data-access helper. Nothing in the current codebase reads or writes completions yet (that feature is still unbuilt), so this plan does not create that file — it'll be added when the completions feature itself is built, to avoid unused speculative code. Everything else in the spec's file list is implemented below.

---

### Task 1: Swap dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update `package.json`**

Replace the `dependencies` and `scripts` blocks:

```json
{
  "name": "bingoal",
  "version": "0.1.0",
  "private": true,
  "description": "Fun, funky goal & event bingo cards you can build, track, and complete.",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "firebase": "^11.2.0",
    "firebase-admin": "^13.0.2",
    "lucide-react": "^0.469.0",
    "next": "16.2.10",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.10",
    "prettier": "^3.4.2",
    "prettier-plugin-tailwindcss": "^0.6.9",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: lockfile updates, `firebase` and `firebase-admin` installed, `@supabase/*`, `prisma`, `@prisma/client` removed. (Later tasks still reference the old Supabase/Prisma files, so `npm run build` will fail until Task 12 removes them — that's expected at this point.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap Supabase/Prisma deps for Firebase"
```

---

### Task 2: Environment variables

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Rewrite `src/lib/env.ts`**

```typescript
/** Small helper to read required public env vars with a clear error. */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. See .env.example for setup.`,
    );
  }
  return value;
}

export const env = {
  firebase: {
    apiKey: required(
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    ),
    authDomain: required(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: required(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    appId: required(
      "NEXT_PUBLIC_FIREBASE_APP_ID",
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    ),
  },
  firebaseAdmin: {
    projectId: required("FIREBASE_PROJECT_ID", process.env.FIREBASE_PROJECT_ID),
    clientEmail: required(
      "FIREBASE_CLIENT_EMAIL",
      process.env.FIREBASE_CLIENT_EMAIL,
    ),
    // Vercel/`.env` files store literal "\n" in the private key; restore real newlines.
    privateKey: required(
      "FIREBASE_PRIVATE_KEY",
      process.env.FIREBASE_PRIVATE_KEY,
    ).replace(/\\n/g, "\n"),
  },
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
```

- [ ] **Step 2: Rewrite `.env.example`**

```bash
# ---------------------------------------------------------------------------
# Bingoal environment variables
# Copy this file to `.env.local` and fill in the values.
# Never commit `.env.local` — it is gitignored.
# ---------------------------------------------------------------------------

# Firebase client config — Firebase Console > Project settings > General >
# Your apps > Web app. Safe to expose (not secret).
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"

# Firebase Admin SDK — Firebase Console > Project settings > Service accounts
# > Generate new private key. Server-only secrets, never expose to the client.
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Base URL of the app. No trailing slash.
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/env.ts .env.example
git commit -m "chore: replace Supabase env vars with Firebase config"
```

---

### Task 3: Firebase client SDK

**Files:**
- Create: `src/lib/firebase/client.ts`

- [ ] **Step 1: Write the client init**

```typescript
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { env } from "@/lib/env";

const firebaseConfig = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  appId: env.firebase.appId,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/** Firebase Auth instance for use in Client Components. */
export const auth = getAuth(app);

/** Google-only auth provider. */
export const googleProvider = new GoogleAuthProvider();
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/lib/firebase/client.ts --jsx preserve --esModuleInterop --skipLibCheck`
Expected: no errors referencing this file (project-wide `tsc --noEmit` runs later in Task 16 once all files exist).

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase/client.ts
git commit -m "feat: add Firebase client SDK init"
```

---

### Task 4: Firebase Admin SDK

**Files:**
- Create: `src/lib/firebase/admin.ts`

- [ ] **Step 1: Write the Admin SDK init**

```typescript
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "@/lib/env";

// Reuse a single Admin app across hot reloads / serverless invocations.
const globalForFirebaseAdmin = globalThis as unknown as {
  firebaseAdminApp: App | undefined;
};

const adminApp =
  globalForFirebaseAdmin.firebaseAdminApp ??
  initializeApp({
    credential: cert({
      projectId: env.firebaseAdmin.projectId,
      clientEmail: env.firebaseAdmin.clientEmail,
      privateKey: env.firebaseAdmin.privateKey,
    }),
  });

if (process.env.NODE_ENV !== "production" && getApps().length) {
  globalForFirebaseAdmin.firebaseAdminApp = adminApp;
}

/** Firebase Admin Auth instance — server-only. */
export const adminAuth = getAuth(adminApp);

/** Firestore instance accessed via the Admin SDK — server-only. */
export const db = getFirestore(adminApp);
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/firebase/admin.ts
git commit -m "feat: add Firebase Admin SDK init"
```

---

### Task 5: Firestore data-access helpers

**Files:**
- Create: `src/lib/firestore/profiles.ts`
- Create: `src/lib/firestore/cards.ts`

- [ ] **Step 1: Write `src/lib/firestore/profiles.ts`**

```typescript
import { db } from "@/lib/firebase/admin";

export interface Profile {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Creates or updates the `profiles/{uid}` doc from decoded auth claims. */
export async function upsertProfile(profile: Profile): Promise<void> {
  const now = new Date();
  const ref = db.collection("profiles").doc(profile.uid);
  const snapshot = await ref.get();

  await ref.set(
    {
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      updatedAt: now,
      ...(snapshot.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );
}
```

- [ ] **Step 2: Write `src/lib/firestore/cards.ts`**

```typescript
import { db } from "@/lib/firebase/admin";

export type SquareKind = "CHECK" | "COUNTER";
export type CardLayout = "RANDOM" | "SET";

export interface Square {
  id: string;
  position: number;
  label: string;
  kind: SquareKind;
  goal: number;
  isFreeSpace: boolean;
}

export interface CardSummary {
  id: string;
  name: string;
  gridSize: number;
  hasFreeSpace: boolean;
  layout: CardLayout;
  squareCount: number;
}

/** Lists a user's cards, newest-updated first, with each card's square count. */
export async function listCardsByOwner(ownerId: string): Promise<CardSummary[]> {
  const snapshot = await db
    .collection("cards")
    .where("ownerId", "==", ownerId)
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as {
      name: string;
      gridSize: number;
      hasFreeSpace: boolean;
      layout: CardLayout;
      squares: Square[];
    };

    return {
      id: doc.id,
      name: data.name,
      gridSize: data.gridSize,
      hasFreeSpace: data.hasFreeSpace,
      layout: data.layout,
      squareCount: data.squares?.length ?? 0,
    };
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/firestore/profiles.ts src/lib/firestore/cards.ts
git commit -m "feat: add Firestore data-access helpers for profiles and cards"
```

---

### Task 6: Session-aware `getUser()`

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Rewrite `src/lib/auth.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: verify Firebase session cookie in getUser()"
```

---

### Task 7: Session API route

**Files:**
- Create: `src/app/api/auth/session/route.ts`
- Delete: `src/app/auth/callback/route.ts`
- Delete: `src/app/auth/signout/route.ts`

- [ ] **Step 1: Write `src/app/api/auth/session/route.ts`**

```typescript
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
  const { idToken } = (await request.json()) as { idToken?: string };

  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  const decoded = await adminAuth.verifyIdToken(idToken);

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRES_IN_MS,
  });

  await upsertProfile({
    uid: decoded.uid,
    email: decoded.email ?? null,
    displayName: (decoded.name as string | undefined) ?? null,
    avatarUrl: (decoded.picture as string | undefined) ?? null,
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
```

- [ ] **Step 2: Delete the old Supabase auth routes**

```bash
git rm src/app/auth/callback/route.ts src/app/auth/signout/route.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/session/route.ts
git commit -m "feat: add session cookie route handler, remove Supabase auth routes"
```

---

### Task 8: Middleware on the Node.js runtime

**Files:**
- Modify: `src/middleware.ts`
- Delete: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Rewrite `src/middleware.ts`**

```typescript
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
```

- [ ] **Step 2: Delete the old Supabase middleware helper**

```bash
git rm src/lib/supabase/middleware.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: verify Firebase session cookie in Node.js middleware"
```

---

### Task 9: Google sign-in button

**Files:**
- Modify: `src/components/google-sign-in-button.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

/** Google-only sign-in via Firebase Auth, then mints a server session cookie. */
export function GoogleSignInButton({
  size = "lg",
  label = "Continue with Google",
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signIn() {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error("Failed to establish session");
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size={size} onClick={signIn} disabled={loading}>
      <GoogleGlyph />
      {loading ? "Signing in…" : label}
    </Button>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/google-sign-in-button.tsx
git commit -m "feat: sign in with Firebase Auth Google popup"
```

---

### Task 10: Sign-out button

**Files:**
- Modify: `src/components/sign-out-button.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
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
    await Promise.all([signOut(auth), fetch("/api/auth/session", { method: "DELETE" })]);
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sign-out-button.tsx
git commit -m "feat: sign out via Firebase Auth client SDK"
```

---

### Task 11: Update dashboard pages

**Files:**
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Update `src/app/dashboard/layout.tsx`**

Change the `user?.email` reference (the session user now uses `email`, unchanged, but no longer has Supabase's nested shape) — confirm it still reads correctly:

```tsx
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
          <Link href="/dashboard" className="font-display text-xl font-bold">
            Bingoal
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
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
```

(No change needed here — `SessionUser.email` matches the field name already used. Included for completeness/verification.)

- [ ] **Step 2: Rewrite `src/app/dashboard/page.tsx` to use Firestore instead of Prisma**

```tsx
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { listCardsByOwner } from "@/lib/firestore/cards";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getUser();
  // getUser() is guaranteed by middleware, but keep types honest.
  const cards = user ? await listCardsByOwner(user.uid) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Your cards</h1>
        <Link href="/dashboard/cards/new" className={buttonVariants()}>
          + New card
        </Link>
      </div>

      {cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="text-5xl">🎲</span>
            <div>
              <CardTitle>No cards yet</CardTitle>
              <p className="mt-1 text-muted-foreground">
                Make your first bingo card and start chasing that line.
              </p>
            </div>
            <Link href="/dashboard/cards/new" className={buttonVariants()}>
              Create a card
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.id}>
              <CardContent className="flex flex-col gap-2 py-6">
                <CardTitle>{card.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {card.gridSize}×{card.gridSize} · {card.squareCount} squares
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/layout.tsx src/app/dashboard/page.tsx
git commit -m "feat: read cards from Firestore in the dashboard"
```

---

### Task 12: Remove Supabase and Prisma

**Files:**
- Delete: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- Delete: `src/lib/prisma.ts`
- Delete: `prisma/schema.prisma` (and the `prisma/` directory)

- [ ] **Step 1: Remove the remaining Supabase files**

```bash
git rm src/lib/supabase/client.ts src/lib/supabase/server.ts
```

- [ ] **Step 2: Remove Prisma**

```bash
git rm src/lib/prisma.ts prisma/schema.prisma
rmdir prisma 2>/dev/null || true
```

- [ ] **Step 3: Confirm nothing still references Supabase or Prisma**

Run: `grep -ril "supabase\|@prisma\|prisma/client" src/ package.json`
Expected: no matches (empty output).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Supabase and Prisma"
```

---

### Task 13: Firestore security rules

**Files:**
- Create: `firestore.rules`
- Create: `firebase.json`

- [ ] **Step 1: Write `firestore.rules`**

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // All reads/writes happen server-side through the Admin SDK, which
    // bypasses these rules. This blocks any direct client-side access as
    // defense-in-depth.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Write `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add firestore.rules firebase.json
git commit -m "feat: deny direct client access to Firestore"
```

Note for the engineer: deploying these rules requires the Firebase CLI
(`npx firebase-tools deploy --only firestore:rules`) authenticated against the
project — this is a one-time manual step outside this repo's CI, documented
in Task 15.

---

### Task 14: Update CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace the Supabase/Prisma env and steps**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    name: Lint, typecheck & build
    runs-on: ubuntu-latest

    # Dummy values so the build can evaluate env at build time.
    # No real network calls happen at build time (pages are dynamic).
    env:
      NEXT_PUBLIC_FIREBASE_API_KEY: "ci-placeholder-api-key"
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com"
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "example-project"
      NEXT_PUBLIC_FIREBASE_APP_ID: "ci-placeholder-app-id"
      FIREBASE_PROJECT_ID: "example-project"
      FIREBASE_CLIENT_EMAIL: "firebase-adminsdk-xxxxx@example-project.iam.gserviceaccount.com"
      FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nplaceholder\n-----END PRIVATE KEY-----\n"
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000"

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: use Firebase env vars, drop Prisma generate step"
```

---

### Task 15: Update documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `docs/BACKLOG.md`

- [ ] **Step 1: Update `AGENTS.md`**

In the "Stack & conventions" section, replace:

```
- **Auth is Google-only** via Supabase. Do not add other providers without a
  product decision.
- **Database access is Prisma only** (`src/lib/prisma.ts`). Update
  `prisma/schema.prisma`, then `npm run db:push` and `npm run prisma:generate`.
```

with:

```
- **Auth is Google-only** via Firebase Auth. Do not add other providers
  without a product decision.
- **Database access is Admin-SDK only** (`src/lib/firebase/admin.ts`), from
  Server Components/Server Actions/Route Handlers — never the client Firestore
  SDK. Data-access helpers live in `src/lib/firestore/`.
```

Also update the "Data model" section's mirrored-id note (`Profile.id` mirrors
the Supabase `auth.users` id) to say it mirrors the Firebase Auth `uid`, and
update the environment notes at the bottom to drop the `prisma generate`
mention.

- [ ] **Step 2: Update `docs/ARCHITECTURE.md`**

Replace the file's contents with:

```markdown
# Architecture

A short guide to how Bingoal fits together.

## Overview

```
Browser ──► Next.js (App Router, on Vercel)
              │  Server Components render + Server Actions/Route Handlers mutate
              ├──► Firebase Auth  (Google OAuth, session cookie in an HTTP-only cookie)
              └──► Firebase Admin SDK ──► Firestore (server-only, no client reads/writes)
```

- **Next.js** renders everything. Public marketing lives at `/`; the signed-in
  app lives under `/dashboard`.
- **Firebase Auth** handles Google sign-in. The client SDK signs the user in,
  then a session cookie is minted server-side and verified on every request by
  `src/middleware.ts` (Node.js runtime).
- **Firestore, via the Admin SDK, is the only way we touch the database** —
  there is no client-side Firestore SDK usage anywhere in the app.

## Auth flow

1. User clicks **Continue with Google** (`GoogleSignInButton`, a client
   component), which calls `signInWithPopup` with the Firebase JS SDK.
2. The client gets a Firebase ID token and POSTs it to
   `/api/auth/session`.
3. That route handler verifies the ID token with the Admin SDK, mints an
   HTTP-only session cookie, and **upserts** a `profiles/{uid}` Firestore doc.
4. Middleware guards `/dashboard/*`: no valid session cookie → redirect to `/`.
5. Sign out calls Firebase's client `signOut()` and sends `DELETE
   /api/auth/session`, which clears the cookie and revokes refresh tokens.

## Data model

- **`profiles/{uid}`** — one per user; `uid` mirrors the Firebase Auth user id.
- **`cards/{cardId}`** — `name`, `gridSize` (3 or 5), `hasFreeSpace`, `layout`
  (RANDOM|SET), and an embedded `squares` array (`id`, `position`, `label`,
  `kind`, `goal`, `isFreeSpace`).
- **`cards/{cardId}/completions/{completionId}`** — an append-only log of
  completion steps per square, each with an editable `completedAt`.

### Key design choices

- **`goal` unifies both square types.** A CHECK square is just a COUNTER with a
  goal of 1. UI differs; storage doesn't. This keeps completion logic simple:
  `isComplete = isFreeSpace || completions.length >= goal`.
- **Completions are a log, not a counter.** Storing each step (rather than an
  integer) gives us free history, editable dates, and a natural home for the
  future "photo per completion" feature.
- **Squares are embedded in the card doc.** The grid shape is fixed at
  creation and small (max 25 squares), so embedding gets the whole board in
  one read instead of a subcollection fetch.
- **Layout is fixed at creation.** For RANDOM cards we shuffle once and persist
  each square's `position`, so a card looks the same every visit and BINGO
  lines stay meaningful.

## BINGO detection

Given a card of size `N`, build an `N×N` grid from the embedded `squares`
array by `position`. A cell counts if it's the free space or `completions >=
goal` (completions fetched from the card's `completions` subcollection,
grouped by `squareId`). A BINGO is any fully counted row, column, or
main/anti diagonal. This is where celebration animations will hook in.

## Authorization

Every read/write goes through the Admin SDK, scoped to the authenticated
user's `uid` via `getUser()`. Firestore security rules deny all direct client
access as defense-in-depth (the Admin SDK bypasses rules; see
`firestore.rules`).

## Environments

`.env.example` documents all variables. `NEXT_PUBLIC_FIREBASE_*` config the
client SDK; `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` /
`FIREBASE_PRIVATE_KEY` are the Admin SDK service-account credentials used
server-side only.
```
```

- [ ] **Step 3: Update `README.md`**

Replace the "Tech stack" table's Auth and Database rows:

```markdown
| Auth       | Firebase Auth (Google provider only)               |
| Database   | Firestore, via the Firebase Admin SDK              |
```

Replace the "Prerequisites" list:

```markdown
- Node.js 20+ and npm
- A [Firebase](https://firebase.google.com) project with Firestore and
  Authentication enabled
- The Google sign-in provider enabled in Firebase Authentication
```

Replace steps 2–4 ("Configure environment" through "Configure Google auth in
Supabase") with:

```markdown
### 2. Configure environment

Copy the example env file and fill in your values:

\`\`\`bash
cp .env.example .env.local
\`\`\`

You'll need your Firebase web app config (Project settings → General → Your
apps) and an Admin SDK service account key (Project settings → Service
accounts → Generate new private key).

### 3. Enable Google sign-in

In the Firebase console: **Authentication → Sign-in method → Google**, enable
the provider. Add `localhost` (and your production domain) to
**Authentication → Settings → Authorized domains**.

### 4. Set up Firestore

In the Firebase console, create a Firestore database (production mode is
fine — `firestore.rules` denies all direct client access already). Deploy the
rules file once you have the Firebase CLI set up:

\`\`\`bash
npx firebase-tools deploy --only firestore:rules
\`\`\`
```

Remove the `db:push` / `prisma:generate` / `db:studio` rows from the Scripts
table (keep `dev`, `build`, `start`, `lint`, `typecheck`, `format`).

Replace the "Project structure" block's `lib/` and top-level entries:

```markdown
  lib/
    firebase/                 # client.ts (browser SDK), admin.ts (server SDK)
    firestore/                # profiles.ts, cards.ts — Admin SDK data access
    auth.ts                   # getUser() helper (verifies the session cookie)
firestore.rules               # denies all direct client access
firebase.json                 # points the Firebase CLI at firestore.rules
```

Replace the "Deploying to Vercel" step 3:

```markdown
3. Add your Vercel production domain to Firebase Authentication's
   **Authorized domains** list.
```

and drop the "`prisma generate` runs automatically on install" line from
step 4.

- [ ] **Step 4: Update `docs/BACKLOG.md`**

Change the two completed-item lines:
```
- [x] Supabase Google-only auth (sign in/out, session middleware, callback)
- [x] Prisma schema: Profile, Card, Square, Completion
```
to:
```
- [x] Firebase Google-only auth (sign in/out, session cookie, middleware)
- [x] Firestore data model: profiles, cards (embedded squares), completions
```

Change:
```
- [ ] Supabase Row Level Security policies (defense-in-depth) `chore`
```
to:
```
- [x] Firestore security rules denying direct client access (defense-in-depth) `chore`
```

Change:
```
- [ ] Photos attached to completions (Supabase Storage)
```
to:
```
- [ ] Photos attached to completions (Firebase Storage)
```

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md docs/ARCHITECTURE.md README.md docs/BACKLOG.md
git commit -m "docs: describe Firebase + Firestore architecture"
```

---

### Task 16: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds. (Requires real or placeholder Firebase env vars in
`.env.local` per Task 2 — the Admin SDK client is constructed at module load
time, so a build with no env vars at all will throw; use CI's placeholder
values locally if you don't have a real Firebase project yet.)

- [ ] **Step 4: Manual smoke test**

With a real Firebase project's env vars in `.env.local` (Google sign-in
provider enabled in Firebase Authentication):

1. `npm run dev`, open `http://localhost:3000`.
2. Click **Continue with Google**, complete the popup sign-in.
3. Confirm redirect to `/dashboard` and the header shows your email.
4. Click **Sign out**, confirm redirect to `/`.
5. Manually navigate to `http://localhost:3000/dashboard` while signed out —
   confirm it redirects to `/` with `?signin=1`.

- [ ] **Step 5: Commit any fixes found during verification**

```bash
git add -A
git commit -m "fix: address issues found in final verification"
```

(Skip this step if no fixes were needed.)
