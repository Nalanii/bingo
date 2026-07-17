# AGENTS.md — working guide for automated contributors

This file is the source of truth for anyone (human or AI) writing code in this
repo. `CLAUDE.md` points here. Read it before making changes.

## What this project is

Bingoal is a web app for building **goal & event bingo cards**. Users sign in
with Google, create as many cards as they want, fill each square with a goal,
and complete them to score BINGO. See `README.md` for the product overview and
`docs/ARCHITECTURE.md` for how the pieces fit together.

## Golden rules

1. **Everything here is public on GitHub.** Keep code, comments, and commit
   messages professional and clean. No secrets, no throwaway names, no noise.
2. **Mobile and desktop both matter.** Every UI change must look and work well
   on a phone and a laptop. Design mobile-first.
3. **Keep it fun and funky.** Bold colors, rounded shapes, playful copy. Design
   tokens live in `src/app/globals.css` — restyle there, not with one-off hex.
4. **Small, focused commits** using Conventional Commits (see below).
5. **Never commit `.env.local`** or any credential. Only `.env.example` is tracked.

## Stack & conventions

- **Next.js 16 App Router + TypeScript.** Prefer Server Components; add
  `"use client"` only when you need interactivity or browser APIs.
- **Data mutations go through Server Actions or Route Handlers**, never directly
  from the client. Always authorize against the current user (`getUser()` in
  `src/lib/auth.ts`) before reading/writing another user's data.
- **Styling:** Tailwind CSS v4 utilities + the shadcn/ui-style components in
  `src/components/ui`. Use the semantic tokens (`bg-primary`, `text-muted-foreground`,
  `rounded-[var(--radius-lg)]`, …), not raw colors.
- **Auth is Google-only** via Firebase Auth. Do not add other providers
  without a product decision.
- **Database access is Admin-SDK only** (`src/lib/firebase/admin.ts`), from
  Server Components/Server Actions/Route Handlers — never the client Firestore
  SDK. Data-access helpers live in `src/lib/firestore/`.

## Data model (see `src/lib/firestore/`)

- `Profile` — one row per user, `id` mirrors the Firebase Auth `uid`.
- `Card` — `name`, `gridSize` (3 or 5), `hasFreeSpace`, `layout` (RANDOM|SET).
- `Square` — `position` (fixed grid slot), `label`, `kind` (CHECK|COUNTER),
  `goal` (CHECK == 1, COUNTER == N), `isFreeSpace`.
- `Completion` — one log entry per completion step; `completedAt` is editable.
  CHECK squares get one entry; COUNTER squares get one per increment.

A square is **complete** when it is the free space, or its completion count
`>= goal`. BINGO = any fully-complete row, column, or diagonal.

## Before you open a PR

Run and make sure these pass:

```bash
npm run lint
npm run typecheck
npm run build
```

Format with `npm run format`. Update `docs/BACKLOG.md` and close the matching
GitHub Issue when you finish a tracked task.

## Commit style — Conventional Commits

```
feat: add card builder step for grid size
fix: prevent duplicate completion on rapid taps
chore: bump next to 16.2.10
docs: expand deployment guide
refactor: extract bingo-line detection helper
```

Keep the subject imperative and under ~72 chars. Explain the "why" in the body
when it isn't obvious.

## Environment notes

- `firebase-admin` needs a service account (`FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) available at runtime to
  talk to Firestore; see `.env.example`.
