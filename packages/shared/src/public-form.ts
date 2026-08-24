import { z } from "zod";
import { QuestionSchema } from "./questions";

export const PublicFormSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().optional(),
  version: z.number().int().positive(),
  questions: z.array(QuestionSchema).min(1)
});

export type PublicForm = z.infer<typeof PublicFormSchema>;
