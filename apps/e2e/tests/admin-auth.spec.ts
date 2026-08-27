import { test, expect } from "@playwright/test";

test.describe("Admin authentication", () => {
  test("shows login form at /admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
    await expect(page.getByLabel("Admin password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Admin password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("Sign-in failed. Check the admin password.")
    ).toBeVisible();
  });

  test("correct password shows forms list", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Admin password").fill("test-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Existing forms" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage Forms" })).toBeVisible();
  });

  test("logout returns to home with Login button", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Admin password").fill("test-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Existing forms" })).toBeVisible();

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    await expect(page.getByText("Developer preview")).toBeVisible();
  });
});
