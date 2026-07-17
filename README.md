# Bingoal 🎉

Fun, funky **goal & event bingo cards** you can build, track, and complete.

Make a card for anything — a year of adventures, a reading challenge, a bucket
list — as a **3×3** or **5×5** grid. Fill each square with a one-and-done check
(_"visit a new country"_) or a counter goal (_"do 10 puzzles"_), then tick things
off and chase that **BINGO**.

> **Status:** early days. Auth, the data model, and a funky stub site are in
> place. The card builder and play experience are the next milestones — see the
> [backlog](docs/BACKLOG.md).

> _"Bingoal" is a working name and can change._

## Features

- **Google sign-in** — one-tap auth, nothing else to remember.
- **Unlimited cards** — every signed-in user can make as many as they like.
- **3×3 or 5×5** grids, with an optional **free space**.
- **Two square types** — _check_ (one and done) and _counter_ (reach a target).
- **Random or set order** — shuffle squares into a fixed layout, or keep your order.
- **Completion logging** — every completion is timestamped (and editable).
- **Real BINGO detection** — completed rows, columns, and diagonals are celebrated.
- **Mobile & desktop friendly** — built responsive from the first pixel.

### On the roadmap

Photos per completion · card time frames (e.g. "2026 only") · view-only sharing
with friends via a code · lots of delightful animations.

## Tech stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | [Next.js](https://nextjs.org) 16 (App Router) + TS |
| Styling    | Tailwind CSS v4 + shadcn/ui-style components       |
| Auth       | Firebase Auth (Google provider only)               |
| Database   | Firestore, via the Firebase Admin SDK              |
| Hosting    | Vercel                                             |

## Getting started

### Prerequisites

- Node.js 20+ and npm
- A [Firebase](https://firebase.google.com) project with Firestore and
  Authentication enabled
- The Google sign-in provider enabled in Firebase Authentication

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

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

```bash
npx firebase-tools deploy --only firestore:rules
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                    | Does                                    |
| ------------------------- | --------------------------------------- |
| `npm run dev`             | Start the dev server                    |
| `npm run build`           | Production build                        |
| `npm run start`           | Run the production build                |
| `npm run lint`            | ESLint                                  |
| `npm run typecheck`       | TypeScript, no emit                     |
| `npm run format`          | Prettier write                          |

## Project structure

```
src/
  app/
    page.tsx                 # funky landing page
    api/auth/session/route.ts # verifies ID token, mints/clears session cookie
    dashboard/               # authed area (card list, builder — WIP)
  components/                # UI + feature components
  lib/
    firebase/                 # client.ts (browser SDK), admin.ts (server SDK)
    firestore/                # profiles.ts, cards.ts — Admin SDK data access
    auth.ts                   # getUser() helper (verifies the session cookie)
firestore.rules               # denies all direct client access
firebase.json                 # points the Firebase CLI at firestore.rules
docs/
  ARCHITECTURE.md           # how it fits together + the data model
  BACKLOG.md                # the full task list (mirrors GitHub Issues)
```

## Deploying to Vercel

1. Import the repo into Vercel.
2. Add all variables from `.env.example` to the Vercel project.
3. Add your Vercel production domain to Firebase Authentication's
   **Authorized domains** list.
4. Deploy.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions (commits, branches,
code style). The build/architecture guide for automated contributors lives in
[AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
