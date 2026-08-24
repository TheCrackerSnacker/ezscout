import { z } from "zod";
import { baseQuestionFields } from "./base";

export const CheckboxQuestionSchema = z.object({
  ...baseQuestionFields,
  type: z.literal("checkbox"),
  options: z.array(z.string().min(1)).min(1)
});

export type CheckboxQuestion = z.infer<typeof CheckboxQuestionSchema>;
