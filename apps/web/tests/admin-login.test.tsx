import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Route } from "../src/router";
import { AdminPage } from "../src/admin/AdminPage";

const apiMocks = vi.hoisted(() => ({
  fetchSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn()
}));

vi.mock("../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api")>();
  return {
    ...actual,
    fetchSession: apiMocks.fetchSession,
    login: apiMocks.login,
    logout: apiMocks.logout
  };
});

const adminRoute: Route = { page: "admin" };

describe("Admin login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchSession.mockResolvedValue({ authenticated: false });
  });

  it("shows the server detail, e.g. a rate-limit message, on failure", async () => {
    const { ApiError } = await import("../src/api");
    apiMocks.login.mockRejectedValue(
      new ApiError(
        429,
        "Rate limit exceeded, retry in 1 minute",
        "Rate limit exceeded, retry in 1 minute"
      )
    );

    render(<AdminPage route={adminRoute} />);
    await screen.findByRole("heading", { name: "Admin sign-in" });

    fireEvent.change(screen.getByLabelText("Admin password"), {
      target: { value: "secret" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(
        "Sign-in failed. Rate limit exceeded, retry in 1 minute"
      )
    ).toBeTruthy();
  });

  it("keeps the friendly message for credential failures", async () => {
    const { ApiError } = await import("../src/api");
    apiMocks.login.mockRejectedValue(
      new ApiError(401, "Invalid credentials", "Invalid credentials")
    );

    render(<AdminPage route={adminRoute} />);
    await screen.findByRole("heading", { name: "Admin sign-in" });

    fireEvent.change(screen.getByLabelText("Admin password"), {
      target: { value: "wrong" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Sign-in failed. Check the admin password.")
    ).toBeTruthy();
  });
});