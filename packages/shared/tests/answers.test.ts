import { describe, expect, it } from "vitest";
import { validateAnswers } from "../src/answers/validate";
import {
  checkboxQuestion,
  makeForm,
  numberQuestion,
  radioOptions,
  radioQuestion,
  textQuestion
} from "./fixtures";

function answeredFixture() {
  const text = textQuestion(true);
  const radio = radioQuestion(true);
  const checkbox = checkboxQuestion(false);
  const number = numberQuestion(false, { min: 0, max: 10 });
  return {
    form: makeForm(text, radio, checkbox, number),
    ids: {
      text: text.id,
      radio: radio.id,
      checkbox: checkbox.id,
      number: number.id
    }
  };
}

const validAnswers = (ids: ReturnType<typeof answeredFixture>["ids"]) => ({
  [ids.text]: "Ada Lovelace",
  [ids.radio]: "Red",
  [ids.checkbox]: ["Green", "Blue"],
  [ids.number]: 7
});

describe("validateAnswers", () => {
  it("accepts a fully valid submission", () => {
    const { form, ids } = answeredFixture();
    expect(validateAnswers(form, validAnswers(ids))).toEqual({ ok: true });
  });

  it("flags a missing required answer", () => {
    const { form, ids } = answeredFixture();
    const answers = validAnswers(ids);
    delete answers[ids.text];
    const result = validateAnswers(form, answers);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual({
        questionId: ids.text,
        message: "This question requires an answer"
      });
    }
  });

  it("treats a whitespace-only string as unanswered", () => {
    const { form, ids } = answeredFixture();
    const result = validateAnswers(form, { ...validAnswers(ids), [ids.text]: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].questionId).toBe(ids.text);
    }
  });

  it("allows an optional question to be omitted entirely", () => {
    const { form, ids } = answeredFixture();
    const answers = validAnswers(ids);
    delete answers[ids.checkbox];
    delete answers[ids.number];
    expect(validateAnswers(form, answers)).toEqual({ ok: true });
  });

  it("treats blank strings and empty arrays on optional questions as unanswered", () => {
    const { form, ids } = answeredFixture();
    const answers = {
      ...validAnswers(ids),
      [ids.checkbox]: [],
      [ids.number]: ""
    };
    expect(validateAnswers(form, answers)).toEqual({ ok: true });
  });

  it("rejects answers to unknown question ids", () => {
    const { form, ids } = answeredFixture();
    const result = validateAnswers(form, {
      ...validAnswers(ids),
      "not-a-question": "x"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual({
        questionId: "not-a-question",
        message: "Unknown question id"
      });
    }
  });

  it("rejects a radio answer outside the option list", () => {
    const { form, ids } = answeredFixture();
    const result = validateAnswers(form, { ...validAnswers(ids), [ids.radio]: "Purple" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].message).toContain("one of the provided options");
    }
  });

  it("rejects checkbox selections outside the option list", () => {
    const { form, ids } = answeredFixture();
    const result = validateAnswers(form, {
      ...validAnswers(ids),
      [ids.checkbox]: ["Green", "Mauve"]
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].questionId).toBe(ids.checkbox);
    }
  });

  it("requires at least one selection for a required checkbox", () => {
    const requiredCheckbox = checkboxQuestion(true);
    const form = makeForm(requiredCheckbox);
    const result = validateAnswers(form, { [requiredCheckbox.id]: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].questionId).toBe(requiredCheckbox.id);
    }
  });

  it("enforces number bounds", () => {
    const { form, ids } = answeredFixture();
    const tooSmall = validateAnswers(form, { ...validAnswers(ids), [ids.number]: -1 });
    const tooLarge = validateAnswers(form, { ...validAnswers(ids), [ids.number]: 99 });
    expect(tooSmall.ok).toBe(false);
    expect(tooLarge.ok).toBe(false);
  });

  it("rejects numeric strings in place of numbers", () => {
    const { form, ids } = answeredFixture();
    const result = validateAnswers(form, { ...validAnswers(ids), [ids.number]: "7" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].questionId).toBe(ids.number);
    }
  });

  it("collects every issue in one pass", () => {
    const { form, ids } = answeredFixture();
    const result = validateAnswers(form, {
      [ids.radio]: "NotAnOption",
      [ids.number]: "7",
      stray: true
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(4);
      expect(result.issues.map((i) => i.questionId)).toEqual([
        "stray",
        ids.text,
        ids.radio,
        ids.number
      ]);
    }
  });

  it("exposes stable fixture options for reference integrity", () => {
    expect(radioOptions).toHaveLength(3);
  });
});
