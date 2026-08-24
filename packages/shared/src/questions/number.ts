import { z } from "zod";
import { baseQuestionFields } from "./base";

export const NumberQuestionSchema = z.object({
  ...baseQuestionFields,
  type: z.literal("number"),
  min: z.number().optional(),
  max: z.number().optional()
});

export type NumberQuestion = z.infer<typeof NumberQuestionSchema>;
