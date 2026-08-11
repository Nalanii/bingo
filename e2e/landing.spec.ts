import { test, expect } from "@playwright/test";

test.describe("landing page", () => {
  test("shows the hero and a Google sign-in call to action for signed-out visitors", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Turn anything into a",
    );
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
  });
});
