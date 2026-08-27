import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicForm } from "@ezscout/shared";
import { FormLoader } from "../src/components/FormLoader";

const apiMocks = vi.hoisted(() => ({
  getPublishedForm: vi.fn(),
  submitResponses: vi.fn()
}));

vi.mock("../src/api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/api")>();
  return {
    ...actual,
    getPublishedForm: apiMocks.getPublishedForm,
    submitResponses: apiMocks.submitResponses
  };
});

const FORM_ID = "0198f7a2-7b3c-7000-8000-3b9ac95e4a01";

const publishedForm: PublicForm = {
  id: FORM_ID,
  title: "Field report",
  version: 2,
  questions: [
    {
      id: "0198f7a2-7b3c-7000-8000-3b9ac95e4a02",
      type: "text",
      question: "Name?",
      required: true
    }
  ]
};

describe("FormLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the definition is fetched", async () => {
    apiMocks.getPublishedForm.mockReturnValue(new Promise(() => {}));

    render(<FormLoader formId={FORM_ID} />);

    expect(screen.getByText("Loading form…")).toBeTruthy();
  });

  it("renders the form once the definition loads", async () => {
    apiMocks.getPublishedForm.mockResolvedValue(publishedForm);

    render(<FormLoader formId={FORM_ID} />);

    expect(await screen.findByText("Field report")).toBeTruthy();
    expect(screen.getByLabelText("Name?")).toBeTruthy();
    expect(apiMocks.getPublishedForm).toHaveBeenCalledWith(FORM_ID);
  });

  it("shows a not-found message when the form is missing", async () => {
    const { ApiError } = await import("../src/api");
    apiMocks.getPublishedForm.mockRejectedValue(new ApiError(404, "missing"));

    render(<FormLoader formId={FORM_ID} />);

    expect(
      await screen.findByText(/does not exist or is no longer available/)
    ).toBeTruthy();
  });

  it("shows a generic error for other failures", async () => {
    const { ApiError } = await import("../src/api");
    apiMocks.getPublishedForm.mockRejectedValue(new ApiError(500, "boom"));

    render(<FormLoader formId={FORM_ID} />);

    expect(
      await screen.findByText(/Something went wrong while loading this form/)
    ).toBeTruthy();
  });

  it("submits a valid response through the api", async () => {
    apiMocks.getPublishedForm.mockResolvedValue(publishedForm);
    apiMocks.submitResponses.mockResolvedValue({
      results: [{ index: 0, status: "accepted" }]
    });

    render(<FormLoader formId={FORM_ID} />);
    const nameField = await screen.findByLabelText<HTMLInputElement>("Name?");

    fireEvent.change(nameField, { target: { value: "Ada Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(screen.getByText("Thanks! Your response has been recorded.")).toBeTruthy()
    );
    const submission = apiMocks.submitResponses.mock.calls[0]![0]![0];
    expect(submission).toMatchObject({
      formId: FORM_ID,
      formVersion: publishedForm.version,
      answers: {
        "0198f7a2-7b3c-7000-8000-3b9ac95e4a02": "Ada Lovelace"
      }
    });
  });

  it("refetches the definition when the route changes", async () => {
    apiMocks.getPublishedForm.mockResolvedValue(publishedForm);

    const { rerender } = render(<FormLoader formId={FORM_ID} />);
    await screen.findByText("Field report");

    const otherId = "0198f7a2-7b3c-7000-8000-3b9ac95e4a99";
    rerender(<FormLoader formId={otherId} />);

    await waitFor(() =>
      expect(apiMocks.getPublishedForm).toHaveBeenCalledWith(otherId)
    );
  });
});