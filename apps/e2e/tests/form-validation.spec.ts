import { test, expect } from "@playwright/test";
import { seedPublishedForm } from "../fixtures/helpers";

test.describe("Form validation", () => {
  test("required fields show errors when empty", async ({ page, request }) => {
    const formId = await seedPublishedForm(request);
    await page.goto(`/form/${formId}`);

    await page.getByRole("button", { name: "Submit" }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert.getByText("Your name")).toBeVisible();
    await expect(alert.getByText("Favorite color")).toBeVisible();
  });

  test("filling only required fields succeeds", async ({ page, request }) => {
    const formId = await seedPublishedForm(request);
    await page.goto(`/form/${formId}`);

    await page.getByLabel("Your name").fill("Scout");
    await page.getByLabel("Blue").check();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Thanks! Your response has been recorded.")).toBeVisible();
  });
});
