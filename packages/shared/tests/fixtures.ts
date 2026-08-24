import { randomUUID } from "node:crypto";
import type { Question } from "../src/questions";
import {
  CheckboxQuestionSchema,
  NumberQuestionSchema,
  RadioQuestionSchema,
  TextQuestionSchema,
  TextareaQuestionSchema
} from "../src/questions";
import {
  FormDefinitionSchema,
  type FormDefinition
} from "../src/form-definition";

export const radioOptions = ["Red", "Green", "Blue"];

export function textQuestion(required = false) {
  return TextQuestionSchema.parse({
    id: randomUUID(),
    type: "text",
    question: "What is your name?",
    required
  });
}

export function textareaQuestion(required = false) {
  return TextareaQuestionSchema.parse({
    id: randomUUID(),
    type: "textarea",
    question: "Tell us more",
    required
  });
}

export function radioQuestion(required = false) {
  return RadioQuestionSchema.parse({
    id: randomUUID(),
    type: "radio",
    question: "Pick one",
    options: radioOptions,
    required
  });
}

export function checkboxQuestion(required = false) {
  return CheckboxQuestionSchema.parse({
    id: randomUUID(),
    type: "checkbox",
    question: "Pick many",
    options: radioOptions,
    required
  });
}

export function numberQuestion(
  required = false,
  bounds: { min?: number; max?: number } = {}
) {
  return NumberQuestionSchema.parse({
    id: randomUUID(),
    type: "number",
    question: "How many?",
    required,
    ...bounds
  });
}

export function makeForm(...questions: Question[]): FormDefinition {
  return FormDefinitionSchema.parse({
    title: "Sample form",
    questions
  });
}
