import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormDefinition } from "@ezscout/shared";
import { AdminPage } from "../src/admin/AdminPage";

const validDraft: FormDefinition = {
  title: "Uploaded form",
  questions: [
    {
      id: "0198f7a2-7b3c-7000-8000-3b9ac95e4a01",
      type: "text",
      question: "Name?",
      required: true
    }
  ]
};

const apiMocks = vi.hoisted(() => ({
  fetchSession: vi.fn(),
  fetchAdminForms: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  uploadDefinition: vi.fn(),
  publishForm: vi.fn()
}));

vi.mock("../src/api", () => apiMocks);

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchAdminForms.mockResolvedValue([]);
    apiMocks.uploadDefinition.mockResolvedValue({ id: "form-1" });
    apiMocks.publishForm.mockResolvedValue({ id: "form-1", version: 1 });
  });

  it("shows the sign-in card when unauthenticated", async () => {
    apiMocks.fetchSession.mockResolvedValue({ authenticated: false });

    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByLabelText("Admin password")).toBeTruthy()
    );
  });

  it("signs in and reveals the uploader", async () => {
    apiMocks.fetchSession.mockResolvedValue({ authenticated: false });
    apiMocks.login.mockResolvedValue(undefined);

    render(<AdminPage />);
    await waitFor(() =>
      expect(screen.getByLabelText("Admin password")).toBeTruthy()
    );

    fireEvent.change(screen.getByLabelText("Admin password"), {
      target: { value: "secret" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(
        screen.getByLabelText("Form definition JSON")
      ).toBeTruthy()
    );
    expect(apiMocks.login).toHaveBeenCalledWith("secret");
  });

  it("validates a pasted draft and publishes it as a new form", async () => {
    apiMocks.fetchSession.mockResolvedValue({ authenticated: true });
    apiMocks.fetchAdminForms.mockResolvedValue([
      {
        id: "existing-1",
        title: "Existing form",
        publishedVersion: 1,
        updatedAt: new Date().toISOString()
      }
    ]);

    render(<AdminPage />);
    await waitFor(() =>
      expect(screen.getByLabelText("Form definition JSON")).toBeTruthy()
    );

    fireEvent.change(screen.getByLabelText("Form definition JSON"), {
      target: { value: JSON.stringify(validDraft) }
    });

    expect(screen.getByText(/Valid: .*Uploaded form.*/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Validate & publish" })
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "open form form-1"
      )
    );
    expect(apiMocks.uploadDefinition).toHaveBeenCalledWith(
      validDraft,
      undefined
    );
    expect(apiMocks.publishForm).toHaveBeenCalledWith("form-1");
  });

  it("shows validation issues for an invalid draft", async () => {
    apiMocks.fetchSession.mockResolvedValue({ authenticated: true });

    render(<AdminPage />);
    await waitFor(() =>
      expect(screen.getByLabelText("Form definition JSON")).toBeTruthy()
    );

    fireEvent.change(screen.getByLabelText("Form definition JSON"), {
      target: { value: JSON.stringify({ title: "Broken" }) }
    });

    const alert = await waitFor(() => screen.getByRole("alert"));
    expect(alert.textContent).toContain("schema");
    expect(
      screen.queryByRole("button", { name: "Validate & publish" })
    ).toBeNull();
  });
});
