import { z } from "zod";

export const SubmissionSchema = z.object({
  id: z.uuid(),
  formId: z.uuid(),
  formVersion: z.number().int().positive(),
  submittedAt: z.string().optional(),
  answers: z.record(z.string(), z.unknown())
});

export type Submission = z.infer<typeof SubmissionSchema>;
