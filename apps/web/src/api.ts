import type { PublicForm } from "@ezscout/shared";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface SubmissionPayload {
  formId: string;
  formVersion: number;
  answers: Record<string, unknown>;
}

export interface SubmissionResult {
  status: "accepted" | "duplicate" | "rejected";
  reason?: string;
  issues?: { questionId: string; message: string }[];
}

export async function getPublishedForm(formId: string): Promise<PublicForm> {
  const response = await fetch(`/api/forms/${formId}`);
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to load form (${response.status})`);
  }
  return (await response.json()) as PublicForm;
}

export async function submitResponse(
  payload: SubmissionPayload
): Promise<SubmissionResult> {
  const response = await fetch("/api/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, id: crypto.randomUUID() })
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Submission failed (${response.status})`);
  }
  return (await response.json()) as SubmissionResult;
}
