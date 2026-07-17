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
  `src/proxy.ts` (Node.js runtime — Next.js's post-16 name for what used to be
  `middleware.ts`).
- **Firestore, via the Admin SDK, is the only way we touch the database** —
  there is no client-side Firestore SDK usage anywhere in the app.

## Auth flow

1. User clicks **Continue with Google** (`GoogleSignInButton`, a client
   component), which calls `signInWithRedirect` with the Firebase JS SDK
   (not a popup — popups are unreliable on iOS Safari and in-app webviews).
2. Google redirects back to the app; a `useEffect` calls `getRedirectResult`,
   gets the Firebase ID token, and POSTs it to `/api/auth/session`.
3. That route handler verifies the ID token with the Admin SDK, mints an
   HTTP-only session cookie, and **upserts** a `profiles/{uid}` Firestore doc.
4. `src/proxy.ts` guards `/dashboard/*`: no valid session cookie → redirect to
   `/`. `dashboard/page.tsx` also redirects defensively if `getUser()` returns
   null (closes a narrow gap where a revoked-but-unexpired cookie passes the
   proxy's check but fails the stricter revocation check inside `getUser()`).
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
