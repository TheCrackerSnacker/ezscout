import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormView } from "../src/components/FormView";
import { sampleForm } from "../src/sample-form";

describe("FormView", () => {
  it("renders the form title and every placeholder question", () => {
    render(<FormView definition={sampleForm} />);
    expect(screen.getByText("Scout Field Report")).toBeTruthy();
    expect(screen.getByLabelText("What is your name?")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    expect(screen.getByLabelText(/kilometers/)).toBeTruthy();
  });

  it("blocks submission and lists unanswered required questions", () => {
    render(<FormView definition={sampleForm} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("What is your name?");
    expect(alert.textContent).toContain("Which zone did you scout?");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("confirms a valid submission", () => {
    render(<FormView definition={sampleForm} />);

    fireEvent.change(screen.getByLabelText("What is your name?"), {
      target: { value: "Ada" }
    });
    fireEvent.click(screen.getByLabelText("North"));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("status").textContent).toContain(
      "Thanks! Your response has been recorded."
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps answers in sync while typing", () => {
    render(<FormView definition={sampleForm} />);
    const name = screen.getByLabelText("What is your name?") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Grace" } });
    expect((screen.getByLabelText("What is your name?") as HTMLInputElement).value).toBe("Grace");
  });
});
