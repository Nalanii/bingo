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
| Auth       | Supabase Auth (Google provider only)               |
| Database   | Supabase Postgres via Prisma ORM                   |
| Hosting    | Vercel                                             |

## Getting started

### Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com) project
- A Google OAuth client (configured as a provider in Supabase Auth)

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

You'll need your Supabase URL and anon key (Project Settings → API) and both the
pooled and direct database connection strings (Project Settings → Database).

### 3. Set up the database

```bash
npm run db:push        # push the Prisma schema to Supabase
npm run prisma:generate
```

### 4. Configure Google auth in Supabase

In your Supabase dashboard: **Authentication → Providers → Google**, add your
Google OAuth client ID and secret, and add
`http://localhost:3000/auth/callback` (and your production URL) to the redirect
allow-list.

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
| `npm run db:push`         | Push Prisma schema to the database      |
| `npm run prisma:generate` | Regenerate the Prisma client            |
| `npm run db:studio`       | Open Prisma Studio                      |

## Project structure

```
src/
  app/
    page.tsx                 # funky landing page
    auth/callback/route.ts   # OAuth code exchange + profile upsert
    auth/signout/route.ts    # sign out
    dashboard/               # authed area (card list, builder — WIP)
  components/                # UI + feature components
  lib/
    supabase/                # browser/server clients + session middleware
    prisma.ts                # Prisma client singleton
    auth.ts                  # getUser() helper
prisma/
  schema.prisma             # Profile, Card, Square, Completion
docs/
  ARCHITECTURE.md           # how it fits together + the data model
  BACKLOG.md                # the full task list (mirrors GitHub Issues)
```

## Deploying to Vercel

1. Import the repo into Vercel.
2. Add all variables from `.env.example` to the Vercel project.
3. Set `NEXT_PUBLIC_SITE_URL` to your production URL and add
   `<your-url>/auth/callback` to Supabase's redirect allow-list.
4. Deploy. `prisma generate` runs automatically on install.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions (commits, branches,
code style). The build/architecture guide for automated contributors lives in
[AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
