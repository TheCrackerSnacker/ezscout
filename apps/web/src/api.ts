import type {
  FormDefinition,
  PublicForm,
  Submission,
  SubmissionBatchResult
} from "@ezscout/shared";
import { db } from "./offline/db";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AdminFormSummary {
  id: string;
  title: string;
  publishedVersion: number | null;
  updatedAt: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new ApiError(response.status, `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function getPublishedForm(formId: string): Promise<PublicForm> {
  try {
    const form = await requestJson<PublicForm>(`/api/forms/${formId}`);
    await db.forms.put({
      id: formId,
      definition: form,
      fetchedAt: Date.now()
    });
    return form;
  } catch (error) {
    if (navigator.onLine) throw error;
    const cached = await db.forms.get(formId);
    if (cached) return cached.definition;
    throw error;
  }
}

export interface QueuedBatchResult extends SubmissionBatchResult {
  queued?: boolean;
}

export async function submitResponses(
  submissions: Submission[]
): Promise<QueuedBatchResult> {
  if (!navigator.onLine) {
    await db.outbox.bulkAdd(
      submissions.map((s) => ({
        id: s.id,
        formId: s.formId,
        formVersion: s.formVersion,
        answers: s.answers as Record<string, unknown>,
        submittedAt: s.submittedAt ?? new Date().toISOString(),
        createdAt: Date.now()
      })),
      { allKeys: false }
    );
    return {
      results: submissions.map((s, i) => ({
        index: i,
        id: s.id,
        status: "accepted" as const,
        queued: true
      })),
      queued: true
    };
  }

  return requestJson<QueuedBatchResult>("/api/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responses: submissions })
  });
}

export async function fetchSession(): Promise<{ authenticated: boolean }> {
  return requestJson<{ authenticated: boolean }>("/api/admin/session");
}

export async function login(password: string): Promise<void> {
  await requestJson("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
}

export async function logout(): Promise<void> {
  await requestJson("/api/admin/logout", { method: "POST" });
}

export async function fetchAdminForms(): Promise<AdminFormSummary[]> {
  const body = await requestJson<{ forms: AdminFormSummary[] }>(
    "/api/admin/forms"
  );
  return body.forms;
}

export async function uploadDefinition(
  definition: FormDefinition,
  targetFormId?: string
): Promise<{ id: string }> {
  if (targetFormId) {
    return requestJson<{ id: string }>(
      `/api/forms/${targetFormId}/definition`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(definition)
      }
    );
  }
  return requestJson<{ id: string }>("/api/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(definition)
  });
}

export async function publishForm(
  formId: string
): Promise<{ id: string; version: number }> {
  return requestJson<{ id: string; version: number }>(
    `/api/forms/${formId}/publish`,
    { method: "POST" }
  );
}

export async function fetchFormDefinition(
  formId: string
): Promise<{
  id: string;
  title: string;
  definition: FormDefinition;
  publishedVersion: number | null;
}> {
  return requestJson(`/api/admin/forms/${formId}`);
}
