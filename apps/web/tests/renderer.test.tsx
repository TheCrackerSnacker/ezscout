import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { RadioQuestion } from "@ezscout/shared";
import { QuestionRenderer } from "../src/questions/registry";

const radioFixture: RadioQuestion = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "radio",
  question: "Please select an option:",
  options: ["1", "2", "3"],
  required: false
};

describe("QuestionRenderer", () => {
  it("renders the question text and one input per radio option", () => {
    render(<QuestionRenderer question={radioFixture} />);
    expect(screen.getByText("Please select an option:")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("emits the chosen option through onChange", () => {
    const onChange = vi.fn();
    render(<QuestionRenderer question={radioFixture} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("2"));
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("supports controlled selection state", () => {
    const { rerender } = render(
      <QuestionRenderer question={radioFixture} value="1" />
    );
    const first = screen.getByLabelText("1") as HTMLInputElement;
    expect(first.checked).toBe(true);

    rerender(<QuestionRenderer question={radioFixture} value="3" />);
    expect((screen.getByLabelText("3") as HTMLInputElement).checked).toBe(true);
    expect(first.checked).toBe(false);
  });
});
