import { describe, expect, it } from "vitest";
import { FormDefinitionSchema } from "../src/form-definition";
import {
  checkboxQuestion,
  makeForm,
  numberQuestion,
  radioQuestion,
  textQuestion,
  textareaQuestion
} from "./fixtures";

describe("FormDefinitionSchema", () => {
  it("accepts the canonical authoring shape", () => {
    const result = FormDefinitionSchema.safeParse({
      title: "Scout report",
      questions: [
        {
          id: crypto.randomUUID(),
          type: "radio",
          question: "Please select an option:",
          options: ["1", "2", "3"]
        }
      ]
    });
    expect(result.success).toBe(true);
  });

  it("defaults required to false when omitted", () => {
    const form = makeForm(textQuestion());
    expect(form.questions[0].required).toBe(false);
  });

  it("keeps required true when explicitly set", () => {
    const form = makeForm(textQuestion(true));
    expect(form.questions[0].required).toBe(true);
  });

  it("rejects unknown question types", () => {
    const result = FormDefinitionSchema.safeParse({
      title: "Bad",
      questions: [{ id: crypto.randomUUID(), type: "dropdown", question: "?" }]
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate question ids", () => {
    const sharedId = crypto.randomUUID();
    const question = { id: sharedId, type: "text" as const, question: "?" };
    const result = FormDefinitionSchema.safeParse({
      title: "Dup",
      questions: [question, { ...question }]
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes(`Duplicate question id: ${sharedId}`)
        )
      ).toBe(true);
    }
  });

  it("requires at least one question", () => {
    const result = FormDefinitionSchema.safeParse({
      title: "Empty",
      questions: []
    });
    expect(result.success).toBe(false);
  });

  it("requires a non-blank title", () => {
    const result = FormDefinitionSchema.safeParse({
      title: "",
      questions: [textQuestion()]
    });
    expect(result.success).toBe(false);
  });

  it("accepts a mixed-type five-question form", () => {
    const form = makeForm(
      textQuestion(),
      textareaQuestion(),
      radioQuestion(),
      checkboxQuestion(),
      numberQuestion()
    );
    expect(form.questions).toHaveLength(5);
    expect(form.title).toBe("Sample form");
  });
});
