# Contributing to Bingoal

Thanks for pitching in! This is a public project — let's keep it clean, kind,
and fun.

## Workflow

We work directly off `main` for now (small project, fast iteration).

1. Pick or open an issue describing the change.
2. Make a focused change with clear, conventional commits.
3. Run the checks below.
4. Push. If you prefer a PR, target `main`.

## Local checks

```bash
npm run lint
npm run typecheck
npm run build
npm run format
```

All should pass before you push.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     a new feature
fix:      a bug fix
docs:     documentation only
refactor: code change that neither fixes a bug nor adds a feature
chore:    tooling, deps, config
style:    formatting only
test:     tests
```

## Code style

- TypeScript, Server Components by default.
- Tailwind v4 + the components in `src/components/ui`; use semantic design tokens.
- Prettier formats everything (`npm run format`).
- Keep accessibility in mind: labels, focus states, and color contrast.

## Reporting bugs / ideas

Open a GitHub Issue with a clear title and steps to reproduce (for bugs) or the
problem you're trying to solve (for features). See `docs/BACKLOG.md` for what's
already planned.
