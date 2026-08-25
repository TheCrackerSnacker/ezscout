import { describe, expect, it } from "vitest";
import {
  BATCH_LIMIT,
  BatchResultItemSchema,
  SubmissionBatchEnvelopeSchema,
  SubmissionBatchResultSchema,
  SubmissionSchema
} from "../src/submissions";

const validSubmission = {
  id: "0198f7a2-7b3c-7000-8000-3b9ac95e4a01",
  formId: "0198f7a2-7b3c-7000-8000-3b9ac95e4a02",
  formVersion: 1,
  answers: {}
};

describe("SubmissionSchema", () => {
  it("accepts a minimal submission", () => {
    const result = SubmissionSchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.submittedAt).toBeUndefined();
    }
  });

  it("rejects non-uuid ids", () => {
    const result = SubmissionSchema.safeParse({
      ...validSubmission,
      id: "response-1"
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero or negative form versions", () => {
    expect(
      SubmissionSchema.safeParse({ ...validSubmission, formVersion: 0 }).success
    ).toBe(false);
    expect(
      SubmissionSchema.safeParse({ ...validSubmission, formVersion: -1 })
        .success
    ).toBe(false);
  });

  it("rejects missing answers entirely", () => {
    const { answers: _omitted, ...withoutAnswers } = validSubmission;
    expect(SubmissionSchema.safeParse(withoutAnswers).success).toBe(false);
  });
});

describe("SubmissionBatchEnvelopeSchema", () => {
  it("accepts a single-item envelope", () => {
    expect(
      SubmissionBatchEnvelopeSchema.safeParse({
        responses: [validSubmission]
      }).success
    ).toBe(true);
  });

  it("rejects an empty batch", () => {
    expect(
      SubmissionBatchEnvelopeSchema.safeParse({ responses: [] }).success
    ).toBe(false);
  });

  it(`rejects more than BATCH_LIMIT (${BATCH_LIMIT}) items`, () => {
    const oversized = Array.from({ length: BATCH_LIMIT + 1 }, () => ({}));
    expect(
      SubmissionBatchEnvelopeSchema.safeParse({ responses: oversized }).success
    ).toBe(false);
  });

  it("rejects a missing or non-array responses key", () => {
    expect(SubmissionBatchEnvelopeSchema.safeParse({}).success).toBe(false);
    expect(
      SubmissionBatchEnvelopeSchema.safeParse({ responses: validSubmission })
        .success
    ).toBe(false);
  });
});

describe("result schemas", () => {
  it("parses a fully populated result item", () => {
    const result = BatchResultItemSchema.safeParse({
      index: 3,
      id: validSubmission.id,
      status: "rejected",
      reason: "validation_failed",
      issues: [{ questionId: "q1", message: "Required" }]
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(
      BatchResultItemSchema.safeParse({ index: 0, status: "maybe" }).success
    ).toBe(false);
  });

  it("round-trips a full batch result", () => {
    const payload = {
      results: [
        { index: 0, status: "accepted" },
        { index: 1, status: "duplicate" }
      ]
    };
    const parsed = SubmissionBatchResultSchema.parse(payload);
    expect(parsed.results).toHaveLength(2);
  });
});
