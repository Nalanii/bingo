# CLAUDE.md

Automated-contributor instructions for this repo live in **[AGENTS.md](AGENTS.md)**.
Read it before making changes. Highlights:

- Everything is public — keep code and commits professional.
- Mobile + desktop must both work; design mobile-first.
- Keep it fun and funky; use the design tokens in `src/app/globals.css`.
- Server Components by default; mutations via Server Actions/Route Handlers.
- Auth is Google-only (Supabase); data access is Prisma-only.
- Before a PR: `npm run lint && npm run typecheck && npm run build`.
- Use Conventional Commits.
