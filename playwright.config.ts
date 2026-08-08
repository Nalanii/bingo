import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    // If a dev server is already running on :3001 locally, reuseExistingServer
    // below will silently test against that instead of a fresh production build.
    baseURL: "http://localhost:3001",
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
  },
  // Chromium only for now — fast CI; add more browsers if cross-browser bugs show up.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // CI already builds the app in a prior step, so just start it there;
    // locally there's no prior build step, so build first.
    command: process.env.CI ? "npm run start" : "npm run build && npm run start",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
