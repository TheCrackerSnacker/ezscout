import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Link, useRoute } from "../src/router";

const FORM_ID = "0198f7a2-7b3c-7000-8000-3b9ac95e4a01";

function Probe() {
  const route = useRoute();
  if (route.page === "home") {
    return (
      <>
        <p>home</p>
        <Link to="/admin">go admin</Link>
      </>
    );
  }
  if (route.page === "form") {
    return <p role="status">form:{route.formId}</p>;
  }
  return <p role="status">admin</p>;
}

describe("router", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("treats unknown paths as home", () => {
    window.history.replaceState(null, "", "/definitely-not-a-route");
    render(<Probe />);
    expect(screen.getByText("home")).toBeTruthy();
  });

  it("parses form deep links by id", () => {
    window.history.replaceState(null, "", `/form/${FORM_ID}`);
    render(<Probe />);
    expect(screen.getByRole("status").textContent).toBe(`form:${FORM_ID}`);
  });

  it("navigates client-side through Link without a reload", () => {
    window.history.replaceState(null, "", "/");
    render(<Probe />);

    fireEvent.click(screen.getByText("go admin"));

    expect(window.location.pathname).toBe("/admin");
    expect(screen.getByRole("status").textContent).toBe("admin");
  });

  it("returns to the previous route on history.back()", async () => {
    window.history.replaceState(null, "", "/");
    render(<Probe />);

    fireEvent.click(screen.getByText("go admin"));
    expect(screen.getByRole("status").textContent).toBe("admin");

    window.history.back();
    await waitFor(() => expect(screen.getByText("home")).toBeTruthy());
    expect(window.location.pathname).toBe("/");
  });
});
