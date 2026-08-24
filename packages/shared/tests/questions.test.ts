import { describe, expect, it } from "vitest";
import {
  QUESTION_SCHEMAS,
  QUESTION_TYPES,
  QuestionSchema
} from "../src/questions";
import {
  checkboxQuestion,
  radioQuestion
} from "./fixtures";

describe("question schemas", () => {
  it("has a registered schema for every declared type", () => {
    QUESTION_TYPES.forEach((type) => {
      expect(QUESTION_SCHEMAS[type]).toBeDefined();
    });
  });

  it("declares exactly the supported set of types", () => {
    expect(Object.keys(QUESTION_SCHEMAS).sort()).toEqual(
      [...QUESTION_TYPES].sort()
    );
  });

  it("parses a minimal payload for every type through the union", () => {
    const payloads: Record<string, Record<string, unknown>> = {
      text: {},
      textarea: {},
      radio: { options: ["a", "b"] },
      checkbox: { options: ["a"] },
      number: {}
    };
    QUESTION_TYPES.forEach((type) => {
      const result = QuestionSchema.safeParse({
        id: crypto.randomUUID(),
        type,
        question: "Q?",
        ...payloads[type]
      });
      expect(result.success).toBe(true);
    });
  });

  it("requires at least two radio options", () => {
    const result = QuestionSchema.safeParse({
      id: crypto.randomUUID(),
      type: "radio",
      question: "Q?",
      options: ["only-one"]
    });
    expect(result.success).toBe(false);
  });

  it("builds a default three-option checkbox", () => {
    const question = checkboxQuestion();
    expect(question.options).toHaveLength(3);
  });

  it("rejects empty option strings", () => {
    const result = QuestionSchema.safeParse({
      id: crypto.randomUUID(),
      type: "radio",
      question: "Q?",
      options: ["a", ""]
    });
    expect(result.success).toBe(false);
  });

  it("keeps ids as uuids", () => {
    const result = QuestionSchema.safeParse({
      id: "q1",
      type: "radio",
      question: "Q?",
      options: ["a", "b"]
    });
    expect(result.success).toBe(false);
  });

  it("round-trips a built radio question", () => {
    const question = radioQuestion(true);
    expect(QuestionSchema.parse(question)).toEqual(question);
  });
});
