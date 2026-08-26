import { test, expect } from "@playwright/test";
import { TEST_FORM } from "../fixtures/helpers";

const VALID_JSON = JSON.stringify(TEST_FORM, null, 2);

test.describe("Admin form CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Admin password").fill("test-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Existing forms" })).toBeVisible();
  });

  test("create and publish a new form", async ({ page }) => {
    await page.getByRole("button", { name: "Create new form" }).click();
    await expect(page.getByRole("heading", { name: "Upload a form definition" })).toBeVisible();

    await page.getByLabel("Form definition JSON").fill(VALID_JSON);
    await expect(page.getByText(/Valid:.*E2E Test Form/)).toBeVisible();
    await expect(page.getByText(`${TEST_FORM.questions.length} question(s)`)).toBeVisible();

    await page.getByRole("button", { name: "Validate & publish" }).click();
    await expect(page.getByText("Published version 1")).toBeVisible();
  });

  test("forms list shows created form", async ({ page }) => {
    await page.getByRole("button", { name: "Create new form" }).click();
    await page.getByLabel("Form definition JSON").fill(VALID_JSON);
    await page.getByRole("button", { name: "Validate & publish" }).click();
    await expect(page.getByText("Published version 1")).toBeVisible();

    await page.getByRole("link", { name: "\u2190 Back to forms" }).click();
    await expect(page.getByRole("cell", { name: TEST_FORM.title }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "1" }).first()).toBeVisible();
  });

  test("edit existing form and publish new version", async ({ page }) => {
    await page.getByRole("button", { name: "Create new form" }).click();
    await page.getByLabel("Form definition JSON").fill(VALID_JSON);
    await page.getByRole("button", { name: "Validate & publish" }).click();
    await expect(page.getByText("Published version 1")).toBeVisible();

    await page.getByRole("link", { name: "\u2190 Back to forms" }).click();
    await page.getByRole("link", { name: "edit" }).first().click();
    await expect(page.getByText("will be published as version 2")).toBeVisible();

    await page.getByRole("button", { name: "Validate & publish" }).click();
    await expect(page.getByText("Published version 2")).toBeVisible();
  });

  test("invalid JSON shows validation error", async ({ page }) => {
    await page.getByRole("button", { name: "Create new form" }).click();
    await page.getByLabel("Form definition JSON").fill("{ invalid json }");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("Not valid JSON")).toBeVisible();
  });
});
