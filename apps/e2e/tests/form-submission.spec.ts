import { test, expect } from "@playwright/test";
import { seedPublishedForm, TEST_FORM } from "../fixtures/helpers";

test.describe("Public form submission", () => {
  test("loads a published form", async ({ page, request }) => {
    const formId = await seedPublishedForm(request);
    await page.goto(`/form/${formId}`);
    await expect(page.getByRole("heading", { name: TEST_FORM.title })).toBeVisible();
    await expect(page.getByText(TEST_FORM.description!)).toBeVisible();
  });

  test("fills and submits a form successfully", async ({ page, request }) => {
    const formId = await seedPublishedForm(request);
    await page.goto(`/form/${formId}`);

    await page.getByLabel("Your name").fill("Jane Scout");
    await page.getByLabel("Red").check();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Thanks! Your response has been recorded.")).toBeVisible();
  });

  test("non-existent form shows 404 error", async ({ page }) => {
    await page.goto("/form/00000000-0000-0000-0000-000000000000");
    await expect(
      page.getByText("This form does not exist or is no longer available.")
    ).toBeVisible();
  });
});
