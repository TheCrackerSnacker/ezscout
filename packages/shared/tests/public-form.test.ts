import { describe, expect, it } from "vitest";
import { PublicFormSchema } from "../src/public-form";

const validPublicForm = {
  id: "0198f7a2-7b3c-7000-8000-3b9ac95e4a01",
  title: "Published form",
  version: 2,
  questions: [
    {
      id: "0198f7a2-7b3c-7000-8000-3b9ac95e4a02",
      type: "radio",
      question: "Pick one:",
      options: ["A", "B"],
      required: true
    }
  ]
};

describe("PublicFormSchema", () => {
  it("accepts the API GET /api/forms/:id shape", () => {
    const result = PublicFormSchema.safeParse(validPublicForm);
    expect(result.success).toBe(true);
  });

  it("allows an optional description", () => {
    const result = PublicFormSchema.safeParse({
      ...validPublicForm,
      description: "Extra context"
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive version", () => {
    expect(
      PublicFormSchema.safeParse({ ...validPublicForm, version: 0 }).success
    ).toBe(false);
  });

  it("rejects an empty question list", () => {
    expect(
      PublicFormSchema.safeParse({ ...validPublicForm, questions: [] }).success
    ).toBe(false);
  });

  it("rejects a missing id", () => {
    const { id: _omitted, ...withoutId } = validPublicForm;
    expect(PublicFormSchema.safeParse(withoutId).success).toBe(false);
  });
});
