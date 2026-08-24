import { z } from "zod";
import { baseQuestionFields } from "./base";

export const TextareaQuestionSchema = z.object({
  ...baseQuestionFields,
  type: z.literal("textarea")
});

export type TextareaQuestion = z.infer<typeof TextareaQuestionSchema>;
