import type { APIRequestContext, Page } from "@playwright/test";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8081";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "test-password";

export const TEST_FORM = {
  title: "E2E Test Form",
  description: "Created by e2e tests",
  questions: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      type: "text",
      question: "Your name",
      required: true
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      type: "radio",
      question: "Favorite color",
      options: ["Red", "Blue", "Green"],
      required: true
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      type: "checkbox",
      question: "Interests",
      options: ["Hiking", "Camping"],
      required: false
    },
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      type: "number",
      question: "Your age",
      min: 0,
      max: 150,
      required: false
    }
  ]
};

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/admin");
  await page.getByLabel("Admin password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin");
}

export async function seedPublishedForm(
  request: APIRequestContext
): Promise<string> {
  const loginResp = await request.post(`${BASE_URL}/api/admin/login`, {
    data: { password: ADMIN_PASSWORD }
  });
  const body = (await loginResp.json()) as { csrfToken?: string };
  const csrf = body.csrfToken ? { "X-CSRF-Token": body.csrfToken } : {};

  const createResp = await request.post(`${BASE_URL}/api/forms`, {
    data: TEST_FORM,
    headers: csrf
  });
  const { id } = (await createResp.json()) as { id: string };
  await request.post(`${BASE_URL}/api/forms/${id}/publish`, { headers: csrf });
  return id;
}
