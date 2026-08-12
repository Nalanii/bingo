# 🎉 Bingoal

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)

Fun, funky **goal & event bingo cards** you can build, track, and complete.

🔥 Live Link: [bingo-psi-liart.vercel.app](https://bingo-psi-liart.vercel.app/)

> **Status:** core loop is built and working — sign in, build a card, play it,
> and get celebrated for a BINGO. Active development is now polish and new
> features (animations, bigger grids, sharing) — see the
> [GitHub Issues](../../issues) board.

> _"Bingoal" is a working name and can change._

## Why

Habit trackers and bucket lists are lists — easy to abandon, no payoff moment.
Bingoal turns the same goals into a bingo card: fill a row, column, or
diagonal and it celebrates with an actual BINGO. Building the card is part of
the fun, and it works for anything with discrete, trackable goals — a reading
challenge, a year of adventures, a chore chart — not just games.

## Features

- 🔐 **Google sign-in** — one-tap auth, nothing else to remember.
- 🗂️ **Unlimited cards** — every signed-in user can make as many as they like.
- 🔲 **3×3 or 5×5** grids, with an optional **free space**.
- ✅ **Two square types** — _check_ (one and done) and _counter_ (reach a target).
- 🎲 **Random or set order** — shuffle squares into a fixed layout, or keep your order.
- 🕒 **Completion logging** — every completion is timestamped (and editable).
- 🏆 **Real BINGO detection** — completed rows, columns, and diagonals are celebrated.
- 📱 **Mobile & desktop friendly** — built responsive from the first pixel.

## On the Roadmap

Photos per completion · card time frames (e.g. "2026 only") · view-only sharing
with friends via a code · lots of delightful animations.

## Requirements

- Node.js 20+ and npm
- A [Firebase](https://firebase.google.com) project with Firestore and
  Authentication enabled
- The Google sign-in provider enabled in Firebase Authentication

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy the example env file and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   You'll need your Firebase web app config (Project settings → General →
   Your apps) and an Admin SDK service account key (Project settings →
   Service accounts → Generate new private key).

   | Variable                           | Required | Description                                            |
   | ---------------------------------- | -------- | ------------------------------------------------------ |
   | `NEXT_PUBLIC_FIREBASE_API_KEY`     | Yes      | Firebase web app config. Safe to expose to the client. |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes      | Firebase web app config. Safe to expose to the client. |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | Yes      | Firebase web app config. Safe to expose to the client. |
   | `NEXT_PUBLIC_FIREBASE_APP_ID`      | Yes      | Firebase web app config. Safe to expose to the client. |
   | `FIREBASE_PROJECT_ID`              | Yes      | Admin SDK service account. Server-only, never expose.  |
   | `FIREBASE_CLIENT_EMAIL`            | Yes      | Admin SDK service account. Server-only, never expose.  |
   | `FIREBASE_PRIVATE_KEY`             | Yes      | Admin SDK service account. Server-only, never expose.  |
   | `NEXT_PUBLIC_SITE_URL`             | Yes      | Base URL of the app, no trailing slash.                |

3. **Enable Google sign-in**

   In the Firebase console: **Authentication → Sign-in method → Google**,
   enable the provider. Add `localhost` (and your production domain) to
   **Authentication → Settings → Authorized domains**.

4. **Set up Firestore**

   In the Firebase console, create a Firestore database (production mode is
   fine — `firestore.rules` denies all direct client access already). Deploy
   the rules file once you have the Firebase CLI set up:

   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

5. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3001](http://localhost:3001).

## Usage

1. Sign in with Google from the landing page.
2. Build a card: pick a 3×3 or 5×5 grid, an optional free space, and fill in
   each square as either a one-and-done **check** or a **counter** goal.
3. Play it: tap a check square to mark it done, or increment/decrement a
   counter toward its goal. Every completion is logged with a date you can
   edit later from the square's history.
4. Complete a row, column, or diagonal for a **BINGO** celebration — or fill
   the whole card for a full blackout celebration.

## Deploying to Vercel

1. Import the repo into Vercel.
2. Add all variables from `.env.example` to the Vercel project.
3. Add your Vercel production domain to Firebase Authentication's
   **Authorized domains** list.
4. Deploy.

## Scripts

| Script              | Does                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | Start the dev server          |
| `npm run build`     | Production build              |
| `npm run start`     | Run the production build      |
| `npm run lint`      | ESLint                        |
| `npm run typecheck` | TypeScript, no emit           |
| `npm run format`    | Prettier write                |
| `npm test`          | Unit tests (Vitest)           |
| `npm run test:e2e`  | End-to-end tests (Playwright) |

## Project Structure

```
src/
  app/
    page.tsx                 # funky landing page
    api/auth/session/route.ts # verifies ID token, mints/clears session cookie
    dashboard/               # authed area (card list, builder, play view)
  components/                # UI + feature components
  lib/
    firebase/                 # client.ts (browser SDK), admin.ts (server SDK)
    firestore/                # profiles.ts, cards.ts — Admin SDK data access
    auth.ts                   # getUser() helper (verifies the session cookie)
firestore.rules               # denies all direct client access
firebase.json                 # points the Firebase CLI at firestore.rules
e2e/                           # Playwright end-to-end specs
docs/
  ARCHITECTURE.md           # how it fits together + the data model
```

Conventions for automated contributors (stack, commit style, checks to run
before a PR) live in [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
