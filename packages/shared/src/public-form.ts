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

export const PublicFormSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().optional(),
  version: z.number().int().positive(),
  publishedAt: z.iso.datetime().optional()
});

export type PublicFormSummary = z.infer<typeof PublicFormSummarySchema>;

export const PublicFormListSchema = z.object({
  forms: z.array(PublicFormSummarySchema)
});

export type PublicFormList = z.infer<typeof PublicFormListSchema>;
