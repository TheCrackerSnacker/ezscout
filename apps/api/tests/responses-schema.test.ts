import { describe, expect, it } from "vitest";
import { SubmissionSchema } from "../src/submissions/schema";

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
      SubmissionSchema.safeParse({ ...validSubmission, formVersion: -1 }).success
    ).toBe(false);
  });

  it("rejects missing answers entirely", () => {
    const { answers: _omitted, ...withoutAnswers } = validSubmission;
    expect(SubmissionSchema.safeParse(withoutAnswers).success).toBe(false);
  });
});
