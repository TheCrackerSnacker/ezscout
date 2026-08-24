import { z } from "zod";
import { CheckboxQuestionSchema } from "./checkbox";
import { NumberQuestionSchema } from "./number";
import { RadioQuestionSchema } from "./radio";
import { TextQuestionSchema } from "./text";
import { TextareaQuestionSchema } from "./textarea";

export * from "./base";
export { CheckboxQuestionSchema, type CheckboxQuestion } from "./checkbox";
export { NumberQuestionSchema, type NumberQuestion } from "./number";
export { RadioQuestionSchema, type RadioQuestion } from "./radio";
export { TextQuestionSchema, type TextQuestion } from "./text";
export { TextareaQuestionSchema, type TextareaQuestion } from "./textarea";

export const QUESTION_TYPES = [
  "text",
  "textarea",
  "radio",
  "checkbox",
  "number"
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_SCHEMAS = {
  text: TextQuestionSchema,
  textarea: TextareaQuestionSchema,
  radio: RadioQuestionSchema,
  checkbox: CheckboxQuestionSchema,
  number: NumberQuestionSchema
} as const;

export const QuestionSchema = z.discriminatedUnion("type", [
  TextQuestionSchema,
  TextareaQuestionSchema,
  RadioQuestionSchema,
  CheckboxQuestionSchema,
  NumberQuestionSchema
]);

export type Question = z.infer<typeof QuestionSchema>;
