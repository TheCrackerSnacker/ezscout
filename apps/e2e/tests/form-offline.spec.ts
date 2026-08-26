import { test, expect } from "@playwright/test";
import { seedPublishedForm } from "../fixtures/helpers";

test.describe("Offline submission", () => {
  test("submitting offline queues and shows pending badge", async ({
    page,
    request,
    context
  }) => {
    const formId = await seedPublishedForm(request);
    await page.goto(`/form/${formId}`);

    await page.getByLabel("Your name").fill("Offline Scout");
    await page.getByLabel("Red").check();

    await context.setOffline(true);

    await page.getByRole("button", { name: "Submit" }).click();
    await expect(
      page.getByText("will be sent automatically when you're back online")
    ).toBeVisible();
    await expect(page.getByText("1 pending")).toBeVisible();
  });
});
