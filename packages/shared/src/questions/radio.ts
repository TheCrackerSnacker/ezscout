import { z } from "zod";
import { baseQuestionFields } from "./base";

export const RadioQuestionSchema = z.object({
  ...baseQuestionFields,
  type: z.literal("radio"),
  options: z.array(z.string().min(1)).min(2)
});

export type RadioQuestion = z.infer<typeof RadioQuestionSchema>;
