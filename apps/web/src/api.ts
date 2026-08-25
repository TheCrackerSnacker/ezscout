import type {
  PublicForm,
  Submission,
  SubmissionBatchResult
} from "@ezscout/shared";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getPublishedForm(formId: string): Promise<PublicForm> {
  const response = await fetch(`/api/forms/${formId}`);
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to load form (${response.status})`);
  }
  return (await response.json()) as PublicForm;
}

export async function submitResponses(
  submissions: Submission[]
): Promise<SubmissionBatchResult> {
  const response = await fetch("/api/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responses: submissions })
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Submission failed (${response.status})`);
  }
  return (await response.json()) as SubmissionBatchResult;
}
