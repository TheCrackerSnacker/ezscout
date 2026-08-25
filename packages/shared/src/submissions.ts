import { z } from "zod";

export const BATCH_LIMIT = 100;

export const SubmissionSchema = z.object({
  id: z.uuid(),
  formId: z.uuid(),
  formVersion: z.number().int().positive(),
  submittedAt: z.string().optional(),
  answers: z.record(z.string(), z.unknown())
});

export type Submission = z.infer<typeof SubmissionSchema>;

/**
 * Structural gate for the request envelope. Items are parsed individually
 * (SubmissionSchema) so one bad submission never fails the whole batch.
 */
export const SubmissionBatchEnvelopeSchema = z.object({
  responses: z.array(z.unknown()).min(1).max(BATCH_LIMIT)
});

export const SubmissionStatusSchema = z.enum([
  "accepted",
  "duplicate",
  "rejected"
]);
export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>;

export const SubmissionAnswerIssueSchema = z.object({
  questionId: z.string(),
  message: z.string()
});

export const BatchResultItemSchema = z.object({
  index: z.number().int().nonnegative(),
  id: z.string().optional(),
  status: SubmissionStatusSchema,
  reason: z.string().optional(),
  issues: z.array(SubmissionAnswerIssueSchema).optional()
});
export type BatchResultItem = z.infer<typeof BatchResultItemSchema>;

export const SubmissionBatchResultSchema = z.object({
  results: z.array(BatchResultItemSchema)
});
export type SubmissionBatchResult = z.infer<typeof SubmissionBatchResultSchema>;
