import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("nav links switch between pages", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Available forms" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();

    await page.getByRole("link", { name: "Home" }).click();
    await expect(
      page.getByRole("heading", { name: "Available forms" })
    ).toBeVisible();
  });

  test("deep link to /admin/new loads editor directly", async ({ page }) => {
    await page.goto("/admin/new");
    await page.getByLabel("Admin password").fill("test-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "Upload a form definition" })
    ).toBeVisible();
  });
});
