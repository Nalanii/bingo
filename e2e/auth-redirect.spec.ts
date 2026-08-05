import { test, expect } from "@playwright/test";

test.describe("dashboard access", () => {
  test("redirects signed-out visitors from the dashboard to the homepage", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // src/proxy.ts gates /dashboard and redirects unauthenticated visitors to
    // "/" with a `signin=1` marker.
    await expect(page).toHaveURL("/?signin=1");
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
  });
});
