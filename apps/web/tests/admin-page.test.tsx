import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormDefinition } from "@ezscout/shared";
import { AdminPage } from "../src/admin/AdminPage";
import type { Route } from "../src/router";

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

const FORM_ID = "0198f7a2-7b3c-7000-8000-3b9ac95e4a01";

const apiMocks = vi.hoisted(() => ({
  fetchAdminForms: vi.fn(),
  fetchFormDefinition: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  uploadDefinition: vi.fn(),
  publishForm: vi.fn()
}));

vi.mock("../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api")>();
  return { ...actual, ...apiMocks };
});

vi.mock("../src/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/router")>();
  return {
    ...actual,
    navigate: vi.fn()
  };
});

const adminRoute: Route = { page: "admin" };
const newRoute: Route = { page: "admin-new" };
const editRoute: Route = { page: "admin-edit", formId: FORM_ID };

const noop = () => {};

function AdminHarness({
  route,
  initialAuthenticated = false
}: {
  route: Route;
  initialAuthenticated?: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  return (
    <AdminPage
      route={route}
      authenticated={authenticated}
      onLogin={() => setAuthenticated(true)}
    />
  );
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchAdminForms.mockResolvedValue([]);
    apiMocks.uploadDefinition.mockResolvedValue({ id: "form-1" });
    apiMocks.publishForm.mockResolvedValue({ id: "form-1", version: 1 });
  });

  it("shows the sign-in card when unauthenticated", async () => {
    render(<AdminHarness route={adminRoute} />);

    await waitFor(() =>
      expect(screen.getByLabelText("Admin password")).toBeTruthy()
    );
  });

  it("signs in and shows the forms list", async () => {
    apiMocks.login.mockResolvedValue(undefined);

    render(<AdminHarness route={adminRoute} />);
    await waitFor(() =>
      expect(screen.getByLabelText("Admin password")).toBeTruthy()
    );

    fireEvent.change(screen.getByLabelText("Admin password"), {
      target: { value: "secret" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(screen.getByText("Existing forms")).toBeTruthy()
    );
    expect(apiMocks.login).toHaveBeenCalledWith("secret");
  });

  it("shows the editor for new forms", async () => {
    render(<AdminPage route={newRoute} authenticated onLogin={noop} />);

    await waitFor(() =>
      expect(screen.getByLabelText("Form definition JSON")).toBeTruthy()
    );
  });

  it("validates and publishes a new form from the editor", async () => {
    apiMocks.fetchAdminForms.mockResolvedValue([]);

    render(<AdminPage route={newRoute} authenticated onLogin={noop} />);
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
      expect(screen.getByRole("status").textContent).toContain("open form")
    );
    expect(apiMocks.uploadDefinition).toHaveBeenCalledWith(
      validDraft,
      undefined
    );
    expect(apiMocks.publishForm).toHaveBeenCalledWith("form-1");
  });

  it("pre-fills the editor when editing an existing form", async () => {
    apiMocks.fetchFormDefinition.mockResolvedValue({
      id: FORM_ID,
      title: "Existing form",
      definition: validDraft,
      publishedVersion: 2
    });

    render(<AdminPage route={editRoute} authenticated onLogin={noop} />);

    await waitFor(() =>
      expect(screen.getByLabelText("Form definition JSON")).toBeTruthy()
    );
    expect(apiMocks.fetchFormDefinition).toHaveBeenCalledWith(FORM_ID);
    expect(screen.getByText("Edit: Existing form")).toBeTruthy();
    expect(screen.getByText(/version 3/)).toBeTruthy();
  });

  it("shows validation issues for an invalid draft", async () => {
    render(<AdminPage route={newRoute} authenticated onLogin={noop} />);
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