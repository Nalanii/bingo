# Firebase + Vercel migration — design

## Context

Bingoal currently uses Supabase for both Google auth and Postgres (via Prisma).
The project is pre-launch — the dashboard is still a stub and no real user
data exists — so this is a clean architecture swap, not a data migration.

Goal: replace Supabase entirely with Firebase (Auth + Firestore). Next.js
keeps hosting on Vercel, unchanged. Fly.io is not used anywhere in this
design.

## Architecture

```
Browser ──► Next.js (App Router, on Vercel — unchanged)
              │  Server Components render + Server Actions/Route Handlers mutate
              ├──► Firebase Auth (Google OAuth, session cookie minted server-side)
              └──► Firebase Admin SDK ──► Firestore (server-only, no client reads/writes)
```

## Auth flow

1. `GoogleSignInButton` (client component) calls the Firebase JS SDK's
   `signInWithPopup(GoogleAuthProvider)`.
2. On success, the client POSTs the Firebase ID token to
   `/api/auth/session`.
3. That route handler verifies the ID token with the Admin SDK, mints an
   HTTP-only session cookie (`createSessionCookie`, ~2 week expiry), and
   upserts a `profiles/{uid}` Firestore doc (mirrors today's callback
   upsert).
4. `src/middleware.ts` runs on the **Node.js runtime** (the Admin SDK needs
   Node APIs, not Edge) and verifies the session cookie via the Admin SDK on
   every request to `/dashboard/*`; missing/invalid session → redirect to
   `/`.
5. Sign-out clears the session cookie and revokes refresh tokens via the
   Admin SDK.

## Data model (Firestore)

- `profiles/{uid}` — `email`, `displayName`, `avatarUrl`, `createdAt`,
  `updatedAt`.
- `cards/{cardId}` — `ownerId`, `name`, `gridSize`, `hasFreeSpace`, `layout`,
  and an embedded `squares` array (`id`, `position`, `label`, `kind`, `goal`,
  `isFreeSpace`). The grid shape is fixed at creation and small (max 25
  squares), so embedding gets the whole board in one read.
- `cards/{cardId}/completions/{completionId}` — `squareId`, `completedAt`,
  `note`, `createdAt`. An append-only log, kept as a subcollection because it
  grows over time and is queried/filtered by `squareId`.

BINGO check: fetch the card doc (squares included) plus its `completions`
subcollection, group completions by `squareId`, and compare counts to each
square's `goal`. Same logic as the current Prisma version — `isComplete =
isFreeSpace || completions.length >= goal` — just sourced from two Firestore
reads instead of a SQL join.

## Authorization

All Firestore access happens through the Admin SDK from Server Actions and
Route Handlers only — no client Firestore SDK usage anywhere in the app.
Every query is scoped by `ownerId == session uid`. Firestore security rules
deny all direct client access as defense-in-depth (the Admin SDK bypasses
rules, so this only blocks anyone attempting direct client-side reads).
This replaces the "Prisma only" data-access rule in `AGENTS.md` with
"Admin SDK only."

## Hosting

No change to hosting. Next.js keeps running on Vercel. Firebase supplies
only Auth and Firestore — no Firebase Hosting, no Cloud Functions, no
Fly.io.

## Files affected

**Remove:**
- `src/lib/supabase/` (client.ts, server.ts, middleware.ts)
- `prisma/` (schema.prisma, migrations)
- `DATABASE_URL` / `DIRECT_URL` env vars
- `@supabase/*`, `prisma`, `@prisma/client` dependencies

**Add:**
- `src/lib/firebase/client.ts` — Firebase JS SDK init (for the sign-in
  button)
- `src/lib/firebase/admin.ts` — Firebase Admin SDK init (service account)
- `src/lib/firestore/profiles.ts`, `cards.ts`, `completions.ts` — data-access
  helpers replacing the Prisma calls

**Rewrite:**
- `src/lib/auth.ts` — `getUser()` reads and verifies the session cookie
- `src/middleware.ts` — Node.js runtime, verifies session cookie via Admin
  SDK
- `src/app/auth/callback/route.ts` → `src/app/api/auth/session/route.ts`
- `src/app/auth/signout/route.ts`
- `src/components/google-sign-in-button.tsx`
- `src/components/sign-out-button.tsx`

**Update:**
- `AGENTS.md`, `docs/ARCHITECTURE.md`, `README.md`
- `.env.example`
- `package.json`
- `.github/workflows/ci.yml` if it references Prisma/DB steps

## Env vars

- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, etc. — client SDK config, safe to
  expose (client-side Firebase config is not a secret).
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` —
  Admin SDK service-account credentials, server-only secrets, never
  committed.

## Testing / verification

- `npm run lint && npm run typecheck && npm run build`
- Manual: sign in with Google → land on `/dashboard` → sign out → confirm
  `/dashboard` redirects to `/` when signed out.

## Out of scope

- Building out the actual Card/Square/Completion features (still a stub) —
  this design only covers the auth + persistence foundation they'll sit on.
- Any data migration (none exists to migrate).
