# Playwright E2E Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright end-to-end tests to the project and run them in CI, alongside the existing Vitest unit tests, closing GitHub issue #20.

**Architecture:** Vitest unit testing is already wired up (`npm test`, `vitest.config.ts`, existing `*.test.ts(x)` files) and already runs in `.github/workflows/ci.yml`. The only gap is e2e: install `@playwright/test`, add a `playwright.config.ts` that boots a production build of the Next.js app and points Chromium at it, add a handful of smoke-test specs under `e2e/` covering unauthenticated flows (the only flows a CI runner can exercise without a real Google account), and add two steps to the existing CI job to install browsers and run the suite.

**Tech Stack:** `@playwright/test`, Next.js 16 App Router (already in the repo), the existing `npm run build` / `npm run start` scripts.

## Global Constraints

- Node engines: `^22.22.2 || ^24.15.0 || >=26.0.0` (from `package.json`) — Playwright must work under this range.
- Package manager is npm; `package-lock.json` is tracked and CI runs `npm ci`.
- Everything in this repo is public on GitHub — code, comments, and commit messages must stay professional and clean (AGENTS.md golden rule #1).
- Never commit `.env.local` or any credential — only `.env.example` is tracked (AGENTS.md golden rule #5, already enforced by `.gitignore`).
- Auth is Google-only via Firebase (`signInWithPopup`) — there is no test account or auth bypass available, so e2e specs in this plan cover only unauthenticated flows. Do not attempt to script the Google OAuth popup.
- Commits use Conventional Commits, imperative subject, under ~72 chars (AGENTS.md).
- CI (`.github/workflows/ci.yml`) already sets placeholder Firebase env vars at the job level (`env:` block) so `npm run build` / `npm run start` succeed without real credentials — reuse that env block, don't duplicate it per-step.
- Keep the Playwright project scoped to Chromium only for now (fast CI); this is an intentional, documented scope limit, not an oversight.

---

### Task 1: Install and configure Playwright, add the first smoke test

**Files:**
- Modify: `package.json` (new devDependency `@playwright/test`, two new scripts)
- Create: `playwright.config.ts`
- Modify: `.gitignore` (ignore Playwright's local output dirs)
- Create: `e2e/landing.spec.ts`
- Create (local only, gitignored, **do not commit**): `.env.local`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `playwright.config.ts` (testDir `./e2e`, `baseURL: "http://localhost:3000"`, `webServer` that runs `npm run build && npm run start`); npm script `test:e2e` (`playwright test`) and `test:e2e:ui` (`playwright test --ui`); the `e2e/` directory convention that Tasks 2 and 3 build on.

- [ ] **Step 1: Install the Playwright test package**

Run:

```bash
npm install -D @playwright/test
```

This updates `package.json` and `package-lock.json` automatically — do not hand-edit the dependency version.

- [ ] **Step 2: Install the Chromium browser binary**

Run:

```bash
npx playwright install --with-deps chromium
```

Only Chromium is installed (see Global Constraints) — do not pass `--with-deps` alone (which installs all three browsers).

- [ ] **Step 3: Add `playwright.config.ts`**

Create `playwright.config.ts` at the repo root with exactly this content:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

This builds and boots a production server before the suite runs (matching what real users hit), and reuses an already-running dev server locally so repeat runs are fast.

- [ ] **Step 4: Add the npm scripts**

In `package.json`, in the `"scripts"` object, add these two entries (keep existing scripts as-is; place these after `"test": "vitest run"`):

```json
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 5: Ignore Playwright's local output**

In `.gitignore`, under the existing `# testing` section (which currently has `/coverage`), add:

```
/test-results/
/playwright-report/
/playwright/.cache/
```

- [ ] **Step 6: Write the first e2e spec**

Create `e2e/landing.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("landing page", () => {
  test("shows the hero and a Google sign-in call to action for signed-out visitors", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Turn your goals into a",
    );
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
  });
});
```

This asserts against `src/app/page.tsx`'s actual copy and the `GoogleSignInButton` component's actual accessible name — do not invent selectors that aren't in the rendered markup.

- [ ] **Step 7: Create a local-only env file so the app can boot**

`firebase-admin` reads its credentials at module load time (`src/lib/firebase/admin.ts`), so `npm run build` / `npm run start` need Firebase env vars present even though these specs never sign in. Create `.env.local` (already gitignored — verify with `git status` that it does **not** show as a tracked/staged change) with exactly the placeholder values CI already uses in `.github/workflows/ci.yml`:

```
NEXT_PUBLIC_FIREBASE_API_KEY="ci-placeholder-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="example.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="example-project"
NEXT_PUBLIC_FIREBASE_APP_ID="ci-placeholder-app-id"
FIREBASE_PROJECT_ID="example-project"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@example-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCxYrDIjH2Qa1yy\ndFKSsGulubGcHfUQffMjVarAeZXie7UfMER9X/1eGAzN63uUDoojYuL/F0CEQTAj\nEYOIYaRRzDvH7b7IoLt7ZUYRb+kR1GV6zs2hG7OFQFfUd+MlfBTo3iti9agqmCqv\n2TDRE2lJ5aowGKJvtoW79IKuWqR2+qXxymFjGo0TCE9L5FmhaVMWg+qe4tLMnrRh\nu2I8HEtK+n4xSYaI5RtFKnRlKG/ggqW5lO2FyKNGohtDIcR3sIZdw6vFrCjf0WNY\nzewFMFEGxFzoCGE/nnI6vxXYqMwLh0khdXSzrSD0Mz7tKWkFvOiV91Cwp+ezvczS\nNqMK5xtdAgMBAAECggEAAzlrQ7X0CVY+QNsm7hYpWsGRliggPny/mOaTfDypigyc\nGfVHZW0DfryarPqJDEOoZKTFQgRC7rR9osGMfcPil/8JniR26ZAsYD2SxLnfR2zw\nLEeKitFlVbh58Dl+pj2HZsU1Di8vb5jE+93Lip1a9lYnngiwmS286BH1dyRcJXJ4\nnod86FllD6iuMLozrmUh237winP73eNIUPxC+4aGQun5DCdDA5V4zuaprKcgkb7v\nUW9/HWpUghJ/ZReWaQKVQumR09hdRd+d03f/hvIejS0+kVkgXJpp4x8VeuFykp4i\nam3G8S4FIUY+sjYi8HBsLBpWPlbReboTj3w43ClD2QKBgQDpuGxYTVOEMesSHXBq\ntyA+MPJCpMgejNKWm8u3FlrFPZd8+yRn8U0WtdYEA/6jAkEXP0wBALrk0bU6F11E\nFkeNN8iiNJy3BaT/Z5/zTJbMl4WDNK+bJhBzxcdlOQUY1n+sWcpNz4Db+TlIffFl\n0s4RAQkUmi71YS+Bnxeuumn8OQKBgQDCS4Dc54JJLT6UuCxkH1oqabj5m8H9LoT+\ngFhweMJ7ltGiCYpa9WadKpn/KqzJucaerUGNf78pHzuKRzmRY+/DzOMUAfL/sGYn\n2/E1mokvfDyz27TQQhyVGDDHJFsgoZBIJjyqy66ze7qFB7n+q3fRLtnaKbFYEW4M\n+Ql/YUcgRQKBgQDOveh5I82gvldmKsxqWZsX6EwkT4cGHyOZPi8xwYCBwT3jvHQz\nzeuXDzpFSxNQNopFeiRNLswj5K0eudQyilK4xIOhmFCYRVHy60M+AJ3UVKQxr8U2\nxLEA+A6tp4aute8yEis2MTuXWhol2eJTY+oMeJIDu2+Wd2WCj6xvT065YQKBgCTS\n9JBpnErMNXEwWtF7E7a4JOPB/olCuNgXcSuX55xO4FpqnntQyWr+OQOgjfEJsbg/\nNA5iaNOdZMZ3a1S/8SBWA6+2Et0dDK9/Qv8a0+dZD5QzDtjtvscPN6d2n4LWvCbA\ngH0Kb4j66UXvSfQXgXT3ATkU79S2MPpqdL9cq4NVAoGBAIkCywwNaeCZAwEFq2XK\n28odP3mzCJ5Olc8i+pLNAXau/z6cJDw9Ey/zW3fS0Cr7XDPC0c2NGUTKWF9TedyJ\nrWsWFL8ZeuM3WK5MqDS/sfvosZ4Kteoq8fSlOQ4BDL6RWauCQm8ML+WTpXolaZyD\nHQWRw4R15ik72wb3FI6UBKrt\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

This is the same known-fake CI key already committed in `.github/workflows/ci.yml` (not a real credential). It is only used to let the local production server boot for this task's manual verification — it must not be added to `.gitignore`'s exceptions or committed.

- [ ] **Step 8: Run the e2e suite and verify it passes**

Run:

```bash
npm run test:e2e
```

Expected: 1 passed (chromium), Playwright builds and starts the app itself via `webServer`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json playwright.config.ts .gitignore e2e/landing.spec.ts
git commit -m "test: add Playwright e2e setup with a landing page smoke test"
```

Do not `git add .env.local` — confirm `git status` shows it untracked/ignored before committing.

---

### Task 2: Add smoke tests for the 404 page and the unauthenticated dashboard redirect

**Files:**
- Create: `e2e/not-found.spec.ts`
- Create: `e2e/auth-redirect.spec.ts`

**Interfaces:**
- Consumes: `playwright.config.ts` and the `test:e2e` script from Task 1; no new config.
- Produces: nothing further tasks depend on.

- [ ] **Step 1: Write the 404 spec**

Create `e2e/not-found.spec.ts`. This exercises `src/app/not-found.tsx`:

```ts
import { test, expect } from "@playwright/test";

test.describe("404 page", () => {
  test("shows a not-found message and links back to the homepage", async ({
    page,
  }) => {
    await page.goto("/this-page-does-not-exist");

    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Go back home" }).click();

    await expect(page).toHaveURL("/");
  });
});
```

- [ ] **Step 2: Write the dashboard-redirect spec**

Create `e2e/auth-redirect.spec.ts`. This exercises the `redirect("/")` in `src/app/dashboard/page.tsx` for signed-out visitors:

```ts
import { test, expect } from "@playwright/test";

test.describe("dashboard access", () => {
  test("redirects signed-out visitors from the dashboard to the homepage", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the full e2e suite and verify all specs pass**

Run:

```bash
npm run test:e2e
```

Expected: 3 passed (chromium) — the Task 1 landing spec plus these two.

- [ ] **Step 4: Commit**

```bash
git add e2e/not-found.spec.ts e2e/auth-redirect.spec.ts
git commit -m "test: add e2e coverage for the 404 page and dashboard auth redirect"
```

---

### Task 3: Run the e2e suite in CI and document it

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `AGENTS.md` (pre-PR checklist)

**Interfaces:**
- Consumes: the `test:e2e` npm script from Task 1.
- Produces: nothing further tasks depend on (final task).

- [ ] **Step 1: Add CI steps for Playwright**

In `.github/workflows/ci.yml`, after the existing `- name: Build` step (the last step in the `build` job), add:

```yaml
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: E2E tests
        run: npm run test:e2e

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

These run after lint/typecheck/unit-test/build so the (slower) browser install and e2e run only happen once the cheaper checks already passed. No changes to the job's `env:` block are needed — it already exports the placeholder Firebase vars every step in the job sees, and Task 1's `webServer` command relies on exactly that.

- [ ] **Step 2: Update the pre-PR checklist**

In `AGENTS.md`, under `## Before you open a PR`, the fenced command block currently reads:

```bash
npm run lint
npm run typecheck
npm run build
```

Replace it with:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

(This also fixes a pre-existing gap: `npm test` runs in CI today but was never listed in this checklist.)

- [ ] **Step 3: Verify CI config is well-formed**

Run:

```bash
npx --yes yaml-lint .github/workflows/ci.yml 2>/dev/null || node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))" 2>/dev/null || echo "no local YAML linter available — visually re-check indentation against the surrounding steps instead"
```

Expected: either a lint tool confirms valid YAML, or (if neither is available in this environment) manually re-read the modified `ci.yml` and confirm the new steps use the same 6-space indentation as the existing `- name: Build` step, with no tabs.

- [ ] **Step 4: Re-run the full local check before committing**

Run, as three separate commands:

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run test:e2e
```

Expected: all three pass (the third should still show 3 passed from Task 2).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml AGENTS.md
git commit -m "ci: run Playwright e2e tests in CI"
```

---

## Self-Review Notes

- **Spec coverage:** issue #20 asks for unit (Vitest — already present and already in CI, unchanged by this plan) and e2e (Playwright — Tasks 1–2) testing, run in CI (Task 3). Covered.
- **No placeholders:** every step has literal file contents, not descriptions.
- **Type/interface consistency:** all three specs import `{ test, expect }` from `@playwright/test` and use the same `page.goto` / `getByRole` pattern; the `test:e2e` script name is identical everywhere it's referenced (config comment, CI step, AGENTS.md checklist).
