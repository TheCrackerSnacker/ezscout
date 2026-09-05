import { test, expect } from "@playwright/test";
import { seedPublishedForm } from "../fixtures/helpers";

test.describe("Home page", () => {
  test("loads with logo, sign-in, and lists available forms", async ({
    page,
    request
  }) => {
    const formId = await seedPublishedForm(request);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "EZScout" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Available forms" })
    ).toBeVisible();
    const formLink = page.locator(`a[href="/form/${formId}"]`);
    await expect(formLink).toBeVisible();
    await expect(formLink).toHaveText("E2E Test Form");
  });
});
