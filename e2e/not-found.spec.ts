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
