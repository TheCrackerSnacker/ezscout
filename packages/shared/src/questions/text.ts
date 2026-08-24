import { z } from "zod";
import { baseQuestionFields } from "./base";

export const TextQuestionSchema = z.object({
  ...baseQuestionFields,
  type: z.literal("text")
});

export type TextQuestion = z.infer<typeof TextQuestionSchema>;
