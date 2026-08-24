import { z } from "zod";
import { QuestionSchema } from "./questions";

export const FormDefinitionSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    questions: z.array(QuestionSchema).min(1)
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.questions.forEach((question, index) => {
      if (seen.has(question.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate question id: ${question.id}`,
          path: ["questions", index]
        });
      }
      seen.add(question.id);
    });
  });

export type FormDefinitionInput = z.input<typeof FormDefinitionSchema>;
export type FormDefinition = z.output<typeof FormDefinitionSchema>;
