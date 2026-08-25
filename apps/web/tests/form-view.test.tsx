import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BatchResultItem } from "@ezscout/shared";
import { FormView } from "../src/components/FormView";
import { sampleForm } from "../src/sample-form";

const NAME_QUESTION_ID = "11111111-1111-4111-8111-111111111111";

function fillValidAnswers() {
  fireEvent.change(screen.getByLabelText("What is your name?"), {
    target: { value: "Ada" }
  });
  fireEvent.click(screen.getByLabelText("North"));
}

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

  it("shows confirmation when the server accepts an async submission", async () => {
    const onValidSubmit = vi.fn(
      async (
        _answers: Record<string, unknown>
      ): Promise<BatchResultItem> => ({ index: 0, status: "accepted" })
    );
    render(<FormView definition={sampleForm} onValidSubmit={onValidSubmit} />);

    fillValidAnswers();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("recorded")
    );
    const submitted = onValidSubmit.mock.calls[0]?.[0] ?? {};
    expect(submitted[NAME_QUESTION_ID]).toBe("Ada");
  });

  it("surfaces server-side rejection issues", async () => {
    const onValidSubmit = vi.fn(async (): Promise<BatchResultItem> => ({
      index: 0,
      status: "rejected",
      reason: "validation_failed",
      issues: [
        {
          questionId: NAME_QUESTION_ID,
          message: "Name is too short"
        }
      ]
    }));
    render(<FormView definition={sampleForm} onValidSubmit={onValidSubmit} />);

    fillValidAnswers();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("What is your name?");
      expect(alert.textContent).toContain("Name is too short");
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a retry notice when the network request fails", async () => {
    const onValidSubmit = vi.fn(async () => {
      throw new Error("network down");
    });
    render(<FormView definition={sampleForm} onValidSubmit={onValidSubmit} />);

    fillValidAnswers();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(screen.getAllByRole("alert")[0]?.textContent).toContain(
        "try again"
      )
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Submit" }).hasAttribute("disabled")).toBe(false);
  });

  it("confirms a duplicate response distinctly", async () => {
    const onValidSubmit = vi.fn(
      async (): Promise<BatchResultItem> => ({ index: 0, status: "duplicate" })
    );
    render(<FormView definition={sampleForm} onValidSubmit={onValidSubmit} />);

    fillValidAnswers();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "already received"
      )
    );
  });
});
