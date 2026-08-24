import { z } from "zod";

export const questionIdSchema = z.uuid();

export const baseQuestionFields = {
  id: questionIdSchema,
  question: z.string().min(1),
  required: z.boolean().default(false)
};
