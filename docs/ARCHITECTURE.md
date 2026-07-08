# Architecture

A short guide to how Bingoal fits together.

## Overview

```
Browser ──► Next.js (App Router, on Vercel)
              │  Server Components render + Server Actions/Route Handlers mutate
              ├──► Supabase Auth  (Google OAuth, session in cookies)
              └──► Prisma ──► Supabase Postgres
```

- **Next.js** renders everything. Public marketing lives at `/`; the signed-in
  app lives under `/dashboard`.
- **Supabase Auth** handles Google sign-in. The session is stored in cookies and
  refreshed on every request by `src/middleware.ts` → `src/lib/supabase/middleware.ts`.
- **Prisma** is the only way we touch the database.

## Auth flow

1. User clicks **Continue with Google** (`GoogleSignInButton`, a client component).
2. `supabase.auth.signInWithOAuth` redirects to Google, then back to
   `/auth/callback`.
3. `auth/callback/route.ts` exchanges the code for a session and **upserts** a
   `Profile` row (id = Supabase user id).
4. Middleware guards `/dashboard/*`: no session → redirect to `/`.
5. Sign out posts to `/auth/signout`.

## Data model

See `prisma/schema.prisma`. Four tables:

- **Profile** — one per user; `id` mirrors `auth.users.id`.
- **Card** — `name`, `gridSize` (3 or 5), `hasFreeSpace`, `layout` (RANDOM|SET).
- **Square** — belongs to a card at a fixed `position`; has a `label`, a `kind`
  (CHECK or COUNTER), a `goal`, and an `isFreeSpace` flag.
- **Completion** — an append-only log of completion steps per square, each with an
  editable `completedAt`.

### Key design choices

- **`goal` unifies both square types.** A CHECK square is just a COUNTER with a
  goal of 1. UI differs; storage doesn't. This keeps completion logic simple:
  `isComplete = isFreeSpace || completions.length >= goal`.
- **Completions are a log, not a counter.** Storing each step (rather than an
  integer) gives us free history, editable dates, and a natural home for the
  future "photo per completion" feature.
- **Layout is fixed at creation.** For RANDOM cards we shuffle once and persist
  each square's `position`, so a card looks the same every visit and BINGO lines
  stay meaningful.

## BINGO detection

Given a card of size `N`, build an `N×N` grid from squares by `position`. A cell
counts if it's the free space or `completions >= goal`. A BINGO is any fully
counted row, column, or main/anti diagonal. This is where celebration animations
will hook in.

## Authorization

Every read/write is scoped to the authenticated user via `getUser()`. Supabase
Row Level Security is planned as defense-in-depth (see `docs/BACKLOG.md`).

## Environments

`.env.example` documents all variables. `DATABASE_URL` uses the pooled Supabase
connection (for serverless runtime); `DIRECT_URL` uses the direct connection
(for Prisma migrations).
