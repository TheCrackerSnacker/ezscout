import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads with title and nav links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("EZScout");
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  });

  test("renders sample form with all question types", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Scout Field Report")).toBeVisible();
    await expect(page.getByText("What is your name?")).toBeVisible();
    await expect(page.getByText("Which zone did you scout?")).toBeVisible();
    await expect(page.getByText("Any additional observations?")).toBeVisible();
    await expect(page.getByText("What did you observe?")).toBeVisible();
    await expect(
      page.getByText("How many kilometers did you cover?")
    ).toBeVisible();
  });

  test("sample form submits in demo mode", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("What is your name?").fill("Test Scout");
    await page.getByLabel("North").check();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Thanks! Your response has been recorded.")).toBeVisible();
  });
});
